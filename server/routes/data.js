import { Router } from 'express';
import db from '../db.js';
import { wrap } from '../logger.js';
import { requireAuth, userMgmtActive } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const uid = req => userMgmtActive() ? req.user.id : null;

const TABLES = ['recipes', 'pantry_items', 'cook_diary', 'shopping_list'];

router.delete('/', wrap((req, res) => {
  const u = uid(req);
  for (const t of TABLES) {
    if (u == null) {
      db.prepare(`UPDATE ${t} SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE deleted_at IS NULL`).run();
    } else {
      db.prepare(`UPDATE ${t} SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE user_id = ? AND deleted_at IS NULL`).run(u);
    }
  }
  res.json({ ok: true });
}));

router.get('/export', wrap((req, res) => {
  const u = uid(req);
  const out = { exportedAt: new Date().toISOString() };
  for (const t of TABLES) {
    out[t] = u == null
      ? db.prepare(`SELECT * FROM ${t} WHERE deleted_at IS NULL`).all()
      : db.prepare(`SELECT * FROM ${t} WHERE user_id = ? AND deleted_at IS NULL`).all(u);
  }
  res.json(out);
}));

export default router;
