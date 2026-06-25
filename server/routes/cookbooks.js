/**
 * cookbooks.js — user-curated recipe collections.
 *
 * A recipe lives in N cookbooks via the recipe_cookbook_links join.
 * Cookbooks are user-scoped, soft-deleted, and ordered by sort_order
 * (with insertion order as the tiebreaker).
 */
import { Router } from 'express';
import db from '../db.js';
import { wrap } from '../logger.js';
import { requireAuth, userMgmtActive } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const uid = req => userMgmtActive() ? req.user.id : null;
const userClause = (u) => u == null ? 'user_id IS NULL' : 'user_id = ?';
const userArgs   = (u) => u == null ? [] : [u];

function _slugify(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'cookbook';
}

function _hydrate(row, recipeCount = null) {
  if (!row) return null;
  let smart_filter = null;
  if (row.smart_filter_json) {
    try { smart_filter = JSON.parse(row.smart_filter_json); } catch {}
  }
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    cover_image_url: row.cover_image_url,
    is_smart: !!row.is_smart,
    smart_filter,
    sort_order: row.sort_order,
    recipe_count: recipeCount,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Evaluate a smart-filter JSON against the user's recipes and return
// the matching rows. Supported criteria:
//   { category_id, tags: [], favorites_only, min_rating, max_total_minutes }
// Tags use AND matching (every listed tag must be present).
function _evalSmartFilter(userId, filter) {
  if (!filter || typeof filter !== 'object') return [];
  const where = [`r.deleted_at IS NULL`];
  const args = [];
  if (userId == null) where.push(`r.user_id IS NULL`);
  else { where.push(`r.user_id = ?`); args.push(userId); }
  if (Number.isFinite(filter.category_id)) {
    where.push(`r.category_id = ?`); args.push(filter.category_id);
  }
  if (filter.favorites_only) where.push(`r.favorite = 1`);
  if (Number.isFinite(filter.min_rating)) {
    where.push(`r.rating >= ?`); args.push(filter.min_rating);
  }
  if (Number.isFinite(filter.max_total_minutes)) {
    where.push(`COALESCE(r.prep_minutes, 0) + COALESCE(r.cook_minutes, 0) <= ?`);
    args.push(filter.max_total_minutes);
  }
  const sql = `
    SELECT r.id, r.name, r.description, r.img_url, r.servings, r.rating, r.favorite,
           r.prep_minutes, r.cook_minutes, r.last_cooked_at, r.cook_count, r.tags
      FROM recipes r
     WHERE ${where.join(' AND ')}
     ORDER BY r.updated_at DESC
  `;
  let rows = db.prepare(sql).all(...args);
  // Tag AND-match runs in JS (recipes.tags is JSON-encoded). Cheap
  // enough for any household-scale library.
  const tagFilter = Array.isArray(filter.tags) ? filter.tags.map(s => String(s).toLowerCase()) : [];
  if (tagFilter.length > 0) {
    rows = rows.filter(r => {
      let arr;
      try { arr = JSON.parse(r.tags || '[]'); } catch { arr = []; }
      const have = new Set((Array.isArray(arr) ? arr : []).map(t => String(t).toLowerCase()));
      return tagFilter.every(t => have.has(t));
    });
  }
  // Strip the raw tags JSON before returning.
  return rows.map(r => { const { tags, ...rest } = r; return rest; });
}

// userClause variant for an aliased table (the JOIN paths below).
const userClauseAliased = (u, alias) => u == null ? `${alias}.user_id IS NULL` : `${alias}.user_id = ?`;

// ── GET / — list cookbooks with recipe counts ──────────────────────────
router.get('/', wrap((req, res) => {
  const u = uid(req);
  const rows = db.prepare(
    `SELECT c.*, (
        SELECT COUNT(*) FROM recipe_cookbook_links l
         WHERE l.cookbook_id = c.id
       ) AS recipe_count
       FROM cookbooks c
      WHERE ${userClauseAliased(u, 'c')} AND c.deleted_at IS NULL
      ORDER BY c.sort_order ASC, c.name ASC`
  ).all(...userArgs(u));
  res.json(rows.map(r => _hydrate(r, r.recipe_count)));
}));

// ── PUT /order — rewrite the global cookbook display order ─────────────
// body: { cookbook_ids: [...] } in the desired order.
// Declared before /:id so the static path doesn't get matched as :id.
router.put('/order', wrap((req, res) => {
  const u = uid(req);
  const ids = Array.isArray(req.body?.cookbook_ids)
    ? req.body.cookbook_ids.map(n => parseInt(n, 10)).filter(Number.isFinite)
    : [];
  if (ids.length === 0) return res.status(400).json({ error: 'cookbook_ids required' });
  const own = db.prepare(`SELECT id FROM cookbooks WHERE id = ? AND ${userClause(u)} AND deleted_at IS NULL`);
  const upd = db.prepare(`UPDATE cookbooks SET sort_order = ?, updated_at = datetime('now') WHERE id = ?`);
  const tx = db.transaction(() => {
    ids.forEach((cid, i) => {
      const r = own.get(cid, ...userArgs(u));
      if (r) upd.run(i, cid);
    });
  });
  tx();
  res.json({ ok: true });
}));

// ── GET /:id — single cookbook + the recipes inside ─────────────────────
router.get('/:id', wrap((req, res) => {
  const u = uid(req);
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const cb = db.prepare(
    `SELECT * FROM cookbooks WHERE id = ? AND deleted_at IS NULL`
  ).get(id);
  if (!cb) return res.status(404).json({ error: 'Not found' });
  const isOwner = (u == null && cb.user_id == null) || cb.user_id === u;
  if (!isOwner) return res.status(403).json({ error: 'Forbidden' });

  let recipes;
  if (cb.is_smart) {
    // Smart cookbook: re-evaluate the filter every read. No link table
    // involvement — the matched recipe set is computed live.
    let filter = null;
    try { filter = cb.smart_filter_json ? JSON.parse(cb.smart_filter_json) : null; } catch {}
    recipes = _evalSmartFilter(u, filter || {});
  } else {
    recipes = db.prepare(
      `SELECT r.id, r.name, r.description, r.img_url, r.servings, r.rating, r.favorite,
              r.prep_minutes, r.cook_minutes, r.last_cooked_at, r.cook_count, l.sort_order AS link_order
         FROM recipe_cookbook_links l
         JOIN recipes r ON r.id = l.recipe_id
        WHERE l.cookbook_id = ? AND r.deleted_at IS NULL
        ORDER BY l.sort_order ASC, l.added_at ASC`
    ).all(id);
  }

  res.json({
    ..._hydrate(cb, recipes.length),
    recipes: recipes.map(r => ({
      ...r,
      favorite: !!r.favorite,
    })),
  });
}));

// ── POST / — create ─────────────────────────────────────────────────────
router.post('/', wrap((req, res) => {
  const u = uid(req);
  const name = (req.body?.name || '').toString().trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const description = req.body?.description ? String(req.body.description).trim() || null : null;
  const cover_image_url = req.body?.cover_image_url ? String(req.body.cover_image_url).trim() || null : null;
  const is_smart = req.body?.is_smart ? 1 : 0;
  // Validate + minify the smart filter. Drop unknown keys so the JSON
  // we store stays clean across schema iterations.
  let smart_filter_json = null;
  if (is_smart && req.body?.smart_filter && typeof req.body.smart_filter === 'object') {
    const f = req.body.smart_filter;
    const clean = {};
    if (Number.isFinite(parseInt(f.category_id, 10))) clean.category_id = parseInt(f.category_id, 10);
    if (Array.isArray(f.tags)) clean.tags = f.tags.map(s => String(s).trim()).filter(Boolean);
    if (f.favorites_only === true) clean.favorites_only = true;
    if (Number.isFinite(parseInt(f.min_rating, 10))) clean.min_rating = parseInt(f.min_rating, 10);
    if (Number.isFinite(parseInt(f.max_total_minutes, 10))) clean.max_total_minutes = parseInt(f.max_total_minutes, 10);
    smart_filter_json = JSON.stringify(clean);
  }
  let slug = _slugify(name);
  let n = 2;
  while (db.prepare(
    `SELECT 1 FROM cookbooks WHERE ${userClause(u)} AND slug = ?`
  ).get(...userArgs(u), slug)) {
    slug = `${_slugify(name)}-${n++}`;
  }
  const maxOrder = db.prepare(
    `SELECT COALESCE(MAX(sort_order), -1) AS m FROM cookbooks WHERE ${userClause(u)} AND deleted_at IS NULL`
  ).get(...userArgs(u)).m;
  const result = db.prepare(
    `INSERT INTO cookbooks (user_id, name, slug, description, cover_image_url, is_smart, smart_filter_json, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(u, name, slug, description, cover_image_url, is_smart, smart_filter_json, maxOrder + 1);
  const row = db.prepare(`SELECT * FROM cookbooks WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json(_hydrate(row, 0));
}));

// ── PUT /:id — update ───────────────────────────────────────────────────
router.put('/:id', wrap((req, res) => {
  const u = uid(req);
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const existing = db.prepare(`SELECT * FROM cookbooks WHERE id = ? AND deleted_at IS NULL`).get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const isOwner = (u == null && existing.user_id == null) || existing.user_id === u;
  if (!isOwner) return res.status(403).json({ error: 'Forbidden' });

  const name        = req.body?.name != null ? (String(req.body.name).trim() || existing.name) : existing.name;
  const description = req.body?.description !== undefined
    ? (req.body.description ? String(req.body.description).trim() : null)
    : existing.description;
  const cover_image_url = req.body?.cover_image_url !== undefined
    ? (req.body.cover_image_url ? String(req.body.cover_image_url).trim() : null)
    : existing.cover_image_url;
  const sort_order  = req.body?.sort_order != null && Number.isFinite(parseInt(req.body.sort_order, 10))
    ? parseInt(req.body.sort_order, 10) : existing.sort_order;

  // smart_filter passes through if explicitly provided; otherwise keep
  // existing. Toggling is_smart off blanks the filter so the cookbook
  // becomes a regular link-table one (its existing links, if any,
  // resume control of contents).
  let nextIsSmart = existing.is_smart;
  let nextFilterJson = existing.smart_filter_json;
  if (req.body?.is_smart !== undefined) nextIsSmart = req.body.is_smart ? 1 : 0;
  if (nextIsSmart && req.body?.smart_filter && typeof req.body.smart_filter === 'object') {
    const f = req.body.smart_filter;
    const clean = {};
    if (Number.isFinite(parseInt(f.category_id, 10))) clean.category_id = parseInt(f.category_id, 10);
    if (Array.isArray(f.tags)) clean.tags = f.tags.map(s => String(s).trim()).filter(Boolean);
    if (f.favorites_only === true) clean.favorites_only = true;
    if (Number.isFinite(parseInt(f.min_rating, 10))) clean.min_rating = parseInt(f.min_rating, 10);
    if (Number.isFinite(parseInt(f.max_total_minutes, 10))) clean.max_total_minutes = parseInt(f.max_total_minutes, 10);
    nextFilterJson = JSON.stringify(clean);
  }
  if (!nextIsSmart) nextFilterJson = null;

  db.prepare(
    `UPDATE cookbooks
        SET name = ?, description = ?, cover_image_url = ?, sort_order = ?,
            is_smart = ?, smart_filter_json = ?,
            updated_at = datetime('now')
      WHERE id = ?`
  ).run(name, description, cover_image_url, sort_order, nextIsSmart, nextFilterJson, id);
  const row = db.prepare(`SELECT * FROM cookbooks WHERE id = ?`).get(id);
  const cnt = db.prepare(`SELECT COUNT(*) AS n FROM recipe_cookbook_links WHERE cookbook_id = ?`).get(id).n;
  res.json(_hydrate(row, cnt));
}));

// ── DELETE /:id — soft delete ───────────────────────────────────────────
router.delete('/:id', wrap((req, res) => {
  const u = uid(req);
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const existing = db.prepare(`SELECT * FROM cookbooks WHERE id = ? AND deleted_at IS NULL`).get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const isOwner = (u == null && existing.user_id == null) || existing.user_id === u;
  if (!isOwner) return res.status(403).json({ error: 'Forbidden' });

  db.prepare(
    `UPDATE cookbooks SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).run(id);
  // Hard-delete the join rows so a future cookbook with a recycled id
  // doesn't unexpectedly inherit recipes. (Schema FK is ON DELETE
  // CASCADE; the soft-delete on the parent doesn't trigger that, so
  // do it explicitly.)
  db.prepare(`DELETE FROM recipe_cookbook_links WHERE cookbook_id = ?`).run(id);
  res.json({ ok: true });
}));

// ── POST /:id/recipes — add recipes ─────────────────────────────────────
// body: { recipe_ids: [1,2,3] }
router.post('/:id/recipes', wrap((req, res) => {
  const u = uid(req);
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const cb = db.prepare(`SELECT * FROM cookbooks WHERE id = ? AND deleted_at IS NULL`).get(id);
  if (!cb) return res.status(404).json({ error: 'Not found' });
  const isOwner = (u == null && cb.user_id == null) || cb.user_id === u;
  if (!isOwner) return res.status(403).json({ error: 'Forbidden' });

  const ids = Array.isArray(req.body?.recipe_ids) ? req.body.recipe_ids.map(n => parseInt(n, 10)).filter(Number.isFinite) : [];
  if (ids.length === 0) return res.status(400).json({ error: 'recipe_ids required' });

  // Filter out recipes the user can't reach. Currently same-user only —
  // group-shared recipes can be linked later if visibility expands.
  const ownedIds = new Set(
    db.prepare(
      `SELECT id FROM recipes WHERE id IN (${ids.map(() => '?').join(',')})
        AND ${u == null ? 'user_id IS NULL' : 'user_id = ?'} AND deleted_at IS NULL`
    ).all(...ids, ...userArgs(u)).map(r => r.id)
  );

  const maxOrder = db.prepare(
    `SELECT COALESCE(MAX(sort_order), -1) AS m FROM recipe_cookbook_links WHERE cookbook_id = ?`
  ).get(id).m;
  const ins = db.prepare(
    `INSERT OR IGNORE INTO recipe_cookbook_links (cookbook_id, recipe_id, sort_order)
     VALUES (?, ?, ?)`
  );
  let added = 0;
  let order = maxOrder + 1;
  const tx = db.transaction(() => {
    for (const rid of ids) {
      if (!ownedIds.has(rid)) continue;
      const r = ins.run(id, rid, order++);
      if (r.changes > 0) added++;
    }
  });
  tx();
  res.json({ ok: true, added });
}));

// ── PUT /:id/recipes/order — rewrite the recipe order inside a cookbook
// body: { recipe_ids: [123, 99, 42, ...] } in the desired display order.
// Path is 3 segments so it doesn't collide with the 1-segment PUT /:id.
router.put('/:id/recipes/order', wrap((req, res) => {
  const u = uid(req);
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const cb = db.prepare(`SELECT * FROM cookbooks WHERE id = ? AND deleted_at IS NULL`).get(id);
  if (!cb) return res.status(404).json({ error: 'Not found' });
  const isOwner = (u == null && cb.user_id == null) || cb.user_id === u;
  if (!isOwner) return res.status(403).json({ error: 'Forbidden' });
  const ids = Array.isArray(req.body?.recipe_ids)
    ? req.body.recipe_ids.map(n => parseInt(n, 10)).filter(Number.isFinite)
    : [];
  if (ids.length === 0) return res.status(400).json({ error: 'recipe_ids required' });
  const upd = db.prepare(`UPDATE recipe_cookbook_links SET sort_order = ? WHERE cookbook_id = ? AND recipe_id = ?`);
  const tx = db.transaction(() => { ids.forEach((rid, i) => upd.run(i, id, rid)); });
  tx();
  res.json({ ok: true });
}));

// ── DELETE /:id/recipes/:recipeId — remove a recipe link ────────────────
router.delete('/:id/recipes/:recipeId', wrap((req, res) => {
  const u = uid(req);
  const id = parseInt(req.params.id, 10);
  const recipeId = parseInt(req.params.recipeId, 10);
  if (!Number.isFinite(id) || !Number.isFinite(recipeId)) return res.status(400).json({ error: 'Invalid id' });
  const cb = db.prepare(`SELECT * FROM cookbooks WHERE id = ? AND deleted_at IS NULL`).get(id);
  if (!cb) return res.status(404).json({ error: 'Not found' });
  const isOwner = (u == null && cb.user_id == null) || cb.user_id === u;
  if (!isOwner) return res.status(403).json({ error: 'Forbidden' });

  db.prepare(`DELETE FROM recipe_cookbook_links WHERE cookbook_id = ? AND recipe_id = ?`).run(id, recipeId);
  res.json({ ok: true });
}));

// ── GET /by-recipe/:recipeId — which cookbooks contain this recipe ──────
// Used by the recipe-edit / recipe-view "in cookbooks" pill row.
router.get('/by-recipe/:recipeId', wrap((req, res) => {
  const u = uid(req);
  const recipeId = parseInt(req.params.recipeId, 10);
  if (!Number.isFinite(recipeId)) return res.status(400).json({ error: 'Invalid id' });
  // Permission: the user must own (or be able to view) the recipe.
  const r = db.prepare(`SELECT user_id, visibility FROM recipes WHERE id = ? AND deleted_at IS NULL`).get(recipeId);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const isOwner = (u == null && r.user_id == null) || r.user_id === u;
  if (!isOwner && r.visibility !== 'group') return res.status(403).json({ error: 'Forbidden' });

  const rows = db.prepare(
    `SELECT c.id, c.name, c.slug
       FROM recipe_cookbook_links l
       JOIN cookbooks c ON c.id = l.cookbook_id
      WHERE l.recipe_id = ? AND c.deleted_at IS NULL AND ${userClauseAliased(u, 'c')}`
  ).all(recipeId, ...userArgs(u));
  res.json(rows);
}));

export default router;
