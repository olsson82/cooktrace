/**
 * kitchens.js — multi-user "Kitchen" groups.
 *
 * A Kitchen is a soft group of users that lets a household / roommate
 * setup share recipes as a single action instead of picking each
 * person individually. This MVP exposes:
 *   - Create / list / delete Kitchens (owner-managed)
 *   - Invite + remove members by username
 *   - "Share with Kitchen X" — fans out to per-user recipe_shares
 *
 * Scope of recipe / pantry / shopping queries is unchanged for now —
 * Kitchens are a sharing macro, not a new ownership boundary.
 * Future phases can add kitchen-scoped resources without touching
 * this surface.
 */
import { Router } from 'express';
import db from '../db.js';
import { wrap } from '../logger.js';
import { requireAuth, userMgmtActive } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const uid = req => userMgmtActive() ? req.user.id : null;

function _slugify(name) {
  return String(name).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'kitchen';
}

function _isMember(kitchenId, userId) {
  if (userId == null) return false;
  return !!db.prepare(`SELECT 1 FROM kitchen_members WHERE kitchen_id = ? AND user_id = ?`).get(kitchenId, userId);
}
function _isOwner(kitchenId, userId) {
  if (userId == null) return false;
  const k = db.prepare(`SELECT owner_user_id FROM kitchens WHERE id = ?`).get(kitchenId);
  return k?.owner_user_id === userId;
}

// ── GET / — kitchens this user belongs to ─────────────────────────────
router.get('/', wrap((req, res) => {
  const u = uid(req);
  if (u == null) return res.json([]);
  const rows = db.prepare(`
    SELECT k.id, k.name, k.slug, k.owner_user_id, k.created_at,
           m.role,
           (SELECT COUNT(*) FROM kitchen_members WHERE kitchen_id = k.id) AS member_count
      FROM kitchens k
      JOIN kitchen_members m ON m.kitchen_id = k.id
     WHERE m.user_id = ?
     ORDER BY k.name COLLATE NOCASE ASC
  `).all(u);
  res.json(rows);
}));

// ── POST / — create a kitchen ────────────────────────────────────────
// Caller becomes the owner + first member. In single-user mode the
// feature is unused (no other users to share with) but creation still
// works so the UI doesn't have to special-case.
router.post('/', wrap((req, res) => {
  const u = uid(req);
  if (u == null) return res.status(400).json({ error: 'User management required for Kitchens' });
  const name = (req.body?.name || '').toString().trim();
  if (!name || name.length > 80) return res.status(400).json({ error: 'Name required (max 80 chars)' });

  // Slug uniqueness — append a numeric suffix on collision.
  const baseSlug = _slugify(name);
  let slug = baseSlug, i = 2;
  while (db.prepare(`SELECT 1 FROM kitchens WHERE slug = ?`).get(slug)) {
    slug = `${baseSlug}-${i++}`;
    if (i > 200) return res.status(500).json({ error: 'Could not generate slug' });
  }

  const tx = db.transaction(() => {
    const result = db.prepare(
      `INSERT INTO kitchens (name, slug, owner_user_id) VALUES (?, ?, ?)`
    ).run(name, slug, u);
    const id = result.lastInsertRowid;
    db.prepare(
      `INSERT INTO kitchen_members (kitchen_id, user_id, role) VALUES (?, ?, 'owner')`
    ).run(id, u);
    return id;
  });
  const id = tx();
  const row = db.prepare(`SELECT * FROM kitchens WHERE id = ?`).get(id);
  res.status(201).json({ ...row, role: 'owner', member_count: 1 });
}));

// ── DELETE /:id — owner-only, removes the kitchen + all memberships ──
router.delete('/:id', wrap((req, res) => {
  const u = uid(req);
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!_isOwner(id, u)) return res.status(403).json({ error: 'Only the owner can delete this kitchen' });
  db.prepare(`DELETE FROM kitchens WHERE id = ?`).run(id);
  res.json({ ok: true });
}));

// ── GET /:id/members — list members of a kitchen ─────────────────────
router.get('/:id/members', wrap((req, res) => {
  const u = uid(req);
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!_isMember(id, u)) return res.status(403).json({ error: 'Not a member of this kitchen' });
  const rows = db.prepare(`
    SELECT km.user_id, km.role, km.joined_at,
           u.username, u.full_name
      FROM kitchen_members km
      JOIN users u ON u.id = km.user_id
     WHERE km.kitchen_id = ?
     ORDER BY (km.role = 'owner') DESC, u.username COLLATE NOCASE ASC
  `).all(id);
  res.json(rows);
}));

// ── POST /:id/members — invite a user by username ────────────────────
router.post('/:id/members', wrap((req, res) => {
  const u = uid(req);
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!_isOwner(id, u)) return res.status(403).json({ error: 'Only the owner can add members' });
  const username = (req.body?.username || '').toString().trim();
  if (!username) return res.status(400).json({ error: 'username required' });
  const target = db.prepare(`SELECT id, username, full_name FROM users WHERE username = ? COLLATE NOCASE`).get(username);
  if (!target) return res.status(404).json({ error: `No user named '${username}'` });
  db.prepare(
    `INSERT OR IGNORE INTO kitchen_members (kitchen_id, user_id, role) VALUES (?, ?, 'member')`
  ).run(id, target.id);
  res.status(201).json({ user_id: target.id, username: target.username, full_name: target.full_name, role: 'member' });
}));

// ── DELETE /:id/members/:userId — remove a member (or self-leave) ────
router.delete('/:id/members/:userId', wrap((req, res) => {
  const u = uid(req);
  const id = parseInt(req.params.id, 10);
  const target = parseInt(req.params.userId, 10);
  if (!Number.isFinite(id) || !Number.isFinite(target)) return res.status(400).json({ error: 'Invalid id' });
  // Allowed if requester is owner OR removing themselves.
  if (!_isOwner(id, u) && u !== target) return res.status(403).json({ error: 'Forbidden' });
  // Owners can't remove themselves while still owning — they'd
  // orphan the kitchen. Force them to delete or transfer first.
  if (_isOwner(id, target)) return res.status(400).json({ error: 'Owner cannot leave; delete the kitchen or transfer ownership first' });
  db.prepare(`DELETE FROM kitchen_members WHERE kitchen_id = ? AND user_id = ?`).run(id, target);
  res.json({ ok: true });
}));

// ── POST /:id/share-recipe — fan out a recipe to all kitchen members ──
// Reuses recipe_shares; calling this again is idempotent because of
// the INSERT OR IGNORE on the unique (recipe_id, grantee_id).
router.post('/:id/share-recipe', wrap((req, res) => {
  const u = uid(req);
  const id = parseInt(req.params.id, 10);
  const recipeId = parseInt(req.body?.recipe_id, 10);
  if (!Number.isFinite(id) || !Number.isFinite(recipeId)) return res.status(400).json({ error: 'Invalid id' });
  if (!_isMember(id, u)) return res.status(403).json({ error: 'Not a member of this kitchen' });
  // Confirm the requester owns the recipe.
  const recipe = db.prepare(`SELECT * FROM recipes WHERE id = ? AND deleted_at IS NULL`).get(recipeId);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
  if (recipe.user_id !== u) return res.status(403).json({ error: 'You can only share recipes you own' });

  const members = db.prepare(`SELECT user_id FROM kitchen_members WHERE kitchen_id = ?`).all(id);
  const ins = db.prepare(
    `INSERT OR IGNORE INTO recipe_shares (recipe_id, grantee_id, granted_by) VALUES (?, ?, ?)`
  );
  let added = 0;
  const tx = db.transaction(() => {
    for (const m of members) {
      if (m.user_id === u) continue; // don't share with self
      const r = ins.run(recipeId, m.user_id, u);
      if (r.changes > 0) added++;
    }
  });
  tx();
  res.json({ ok: true, members: members.length - 1, added });
}));

export default router;
