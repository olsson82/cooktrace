/**
 * recipe-scrapers-bridge.js — Node ↔ Python bridge for the
 * `recipe-scrapers` library (https://github.com/hhursev/recipe-scrapers).
 *
 * recipe-scrapers is Python-only. We avoid running a separate Python
 * container by installing python3 + the lib INSIDE this image
 * (Dockerfile) and shelling out to a tiny inline script via
 * `python3 -c "..."`. One container, same ergonomics as Mealie.
 *
 * Health-check at startup: try `python3 --version` and `python3 -c
 * "import recipe_scrapers"`; cache the result so subsequent calls
 * don't fork a process to re-check.
 */
import { spawn } from 'node:child_process';
import { logger } from '../logger.js';
import { parseIngredientLine } from './recipe-scraper.js';

let _availability = null; // null = unchecked, true / false once checked.

const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';

/**
 * Spawn Python and resolve / reject based on stdout/stderr + exit code.
 * Pipes `input` to stdin if provided, applies a timeout, and captures
 * up to MAX_OUT bytes of stdout to avoid runaway scrapers.
 */
function _runPython(args, { input, timeoutMs = 15_000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const MAX_OUT = 1024 * 1024; // 1 MB
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('Python subprocess timeout'));
    }, timeoutMs);
    proc.stdout.on('data', d => {
      stdout += d.toString('utf-8');
      if (stdout.length > MAX_OUT) { proc.kill('SIGKILL'); reject(new Error('Python output too large')); }
    });
    proc.stderr.on('data', d => { stderr += d.toString('utf-8'); });
    proc.on('error', err => { clearTimeout(timer); reject(err); });
    proc.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(stderr.trim() || `Python exited ${code}`));
      resolve(stdout);
    });
    if (input) { proc.stdin.write(input); proc.stdin.end(); }
    else proc.stdin.end();
  });
}

/**
 * Probe whether the Python tier is usable. Cached after first success
 * or failure so subsequent scrapes don't fork a probe each time. Set
 * `force` to retry the probe (e.g. after a deployment change).
 */
export async function isRecipeScrapersAvailable({ force = false } = {}) {
  if (!force && _availability != null) return _availability;
  try {
    await _runPython(['-c', 'import recipe_scrapers; print(recipe_scrapers.__version__)'], { timeoutMs: 5_000 });
    _availability = true;
    logger.info('[recipe-scrapers] available');
  } catch (e) {
    _availability = false;
    logger.info(`[recipe-scrapers] not available: ${e.message?.split('\n')[0] || e}`);
  }
  return _availability;
}

// Inline Python program: read URL + html from stdin, run scrape_html,
// emit our normalised JSON shape on stdout.
const PY_PROGRAM = `
import sys, json
import html as _html
data = json.loads(sys.stdin.read())
url, html = data["url"], data["html"]

try:
    from recipe_scrapers import scrape_html
except Exception as e:
    print(json.dumps({"error": "import failed: " + str(e)}))
    sys.exit(0)

try:
    # supported_only=False makes recipe-scrapers fall back to its
    # generic schema.org parser when no site-specific extractor is
    # registered. Without this flag the library throws
    # WebsiteNotImplementedError for any unknown domain — even when
    # the page has perfect JSON-LD — which makes Enhanced strictly
    # worse than Standard outside the ~300 supported sites. This is
    # how Mealie and Tandoor invoke it.
    s = scrape_html(html, org_url=url, supported_only=False)
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(0)

# Some sites double-encode JSON-LD strings, so recipe-scrapers may
# hand back values with literal HTML entities ("Tortine all&#8217;arancia").
# Decode every string we extract before serialising back to Node.
def _u(v):
    if isinstance(v, str): return _html.unescape(v)
    if isinstance(v, list): return [_u(x) for x in v]
    if isinstance(v, dict): return {k: _u(val) for k, val in v.items()}
    return v

def _safe(fn, default=None):
    try: return _u(fn())
    except Exception: return default

def _ingredient_groups(s):
    # recipe-scrapers exposes ingredient_groups() returning a list of
    # IngredientGroup namedtuples (purpose, ingredients). Older versions
    # only have ingredients(). Handle both.
    out = []
    try:
        groups = s.ingredient_groups()
    except Exception:
        groups = []
    if groups:
        for g in groups:
            items = []
            for line in (g.ingredients or []):
                items.append({"qty": "", "unit": "", "name": str(line), "note": ""})
            out.append({"name": g.purpose or "", "items": items})
        return out
    flat = _safe(s.ingredients) or []
    return [{"name": "", "items": [{"qty": "", "unit": "", "name": str(x), "note": ""} for x in flat]}]

def _instructions(s):
    # Prefer instructions_list (already parsed into steps) over
    # instructions() which can be a single newline-joined blob.
    try:
        steps = s.instructions_list()
    except Exception:
        steps = None
    if not steps:
        raw = _safe(s.instructions) or ""
        steps = [p.strip() for p in raw.split("\\n\\n") if p.strip()]
    return [{"title": "", "text": str(t).strip()} for t in steps if str(t).strip()]

def _yields_to_servings(text):
    if not text: return None
    import re
    m = re.search(r"(\\d+)", str(text))
    return int(m.group(1)) if m else None

result = {
    "name":         _safe(s.title) or "Imported recipe",
    "description":  _safe(s.description) or None,
    "imgUrl":       _safe(s.image) or None,
    "servings":     _yields_to_servings(_safe(s.yields)),
    "yield_text":   _safe(s.yields) or None,
    "prep_minutes": _safe(s.prep_time) or None,
    "cook_minutes": _safe(s.cook_time) or None,
    "ingredients":  _ingredient_groups(s),
    "steps":        _instructions(s),
    "tags":         (_safe(s.keywords) or [])[:12] if isinstance(_safe(s.keywords), list) else [],
    "tools":        _safe(s.equipment) or [],
    "nutrition":    _safe(s.nutrients) or {},
    "source_url":   _safe(s.canonical_url) or url,
    "notes":        None,
    "category_name": (_safe(s.category) or None),
}
print(json.dumps(result))
`;

/**
 * Run recipe-scrapers against pre-fetched HTML. Caller already did
 * the SSRF-guarded fetch; this just hands the bytes to Python.
 *
 * Returns the normalised recipe shape on success, throws on failure.
 */
export async function scrapeWithRecipeScrapers(html, sourceUrl) {
  if (!await isRecipeScrapersAvailable()) {
    throw new Error('recipe-scrapers not installed in this image');
  }
  const stdout = await _runPython(['-c', PY_PROGRAM], {
    input: JSON.stringify({ url: sourceUrl, html }),
    timeoutMs: 15_000,
  });
  let parsed;
  try { parsed = JSON.parse(stdout); }
  catch { throw new Error('recipe-scrapers returned non-JSON'); }
  if (parsed?.error) throw new Error(parsed.error);
  if (!parsed?.name) throw new Error('recipe-scrapers found no recipe name');

  // recipe-scrapers returns each ingredient as a single raw string
  // ("320g unwaxed organic oranges"). Run them through our shared
  // parser so qty / unit / name / note get split out the same way the
  // Standard tier does — without this the Enhanced output looks
  // identical to a broken Standard run.
  if (Array.isArray(parsed.ingredients)) {
    parsed.ingredients = parsed.ingredients.map(g => ({
      name: g?.name || '',
      items: (g?.items || []).map(it => {
        const raw = (it?.name || '').trim();
        if (!raw) return it;
        const split = parseIngredientLine(raw);
        // Keep recipe-scrapers' note/qty/unit if it ever populated
        // them; otherwise take the parser's split.
        return {
          qty:  it.qty  || split.qty  || '',
          unit: it.unit || split.unit || '',
          name: split.name || raw,
          note: it.note || split.note || '',
        };
      }),
    }));
  }

  return parsed;
}
