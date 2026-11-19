const express = require('express');
const router = express.Router();
const { db } = require('../db');

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan Password wajib diisi' });
    }

    const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username.trim());
    if (!user) {
      return res.status(401).json({ error: 'Pengguna tidak ditemukan atau kata sandi salah' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Akun pengguna ini sedang dinonaktifkan oleh Administrator' });
    }

    if (user.password !== password) {
      return res.status(401).json({ error: 'Kata sandi tidak sesuai' });
    }

    let permissions = [];
    try {
      permissions = JSON.parse(user.permissions || '[]');
    } catch (e) {
      permissions = [];
    }

    // Return user info (excluding raw password)
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        permissions,
        is_active: user.is_active
      },
      message: `Selamat datang, ${user.name}!`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/users - List all users
router.get('/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, name, role, permissions, is_active, created_at 
      FROM users 
      ORDER BY role ASC, name ASC
    `).all();

    const formatted = users.map(u => {
      let perms = [];
      try {
        perms = JSON.parse(u.permissions || '[]');
      } catch (e) {
        perms = [];
      }
      return {
        ...u,
        permissions: perms
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/users - Create new user with role and restrictions
router.post('/users', (req, res) => {
  try {
    const { username, password, name, role, permissions } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Username, password, dan nama lengkap wajib diisi' });
    }

    const cleanUsername = username.trim();
    const exists = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(cleanUsername);
    if (exists) {
      return res.status(400).json({ error: `Username "${cleanUsername}" sudah digunakan` });
    }

    const id = 'USR-' + Date.now().toString(36).toUpperCase();
    const permsJson = JSON.stringify(Array.isArray(permissions) ? permissions : []);

    db.prepare(`
      INSERT INTO users (id, username, password, name, role, permissions, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(id, cleanUsername, password, name.trim(), role || 'OPERATOR', permsJson);

    res.json({ success: true, id, message: `Pengguna ${cleanUsername} berhasil didaftarkan` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/users/:id - Update user
router.put('/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, permissions, is_active, password } = req.body;

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    let permsJson = existing.permissions;
    if (permissions !== undefined) {
      permsJson = JSON.stringify(Array.isArray(permissions) ? permissions : []);
    }

    if (password && password.trim() !== '') {
      db.prepare(`
        UPDATE users SET
          name = ?, role = ?, permissions = ?, is_active = ?, password = ?
        WHERE id = ?
      `).run(
        name !== undefined ? name : existing.name,
        role !== undefined ? role : existing.role,
        permsJson,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        password.trim(),
        id
      );
    } else {
      db.prepare(`
        UPDATE users SET
          name = ?, role = ?, permissions = ?, is_active = ?
        WHERE id = ?
      `).run(
        name !== undefined ? name : existing.name,
        role !== undefined ? role : existing.role,
        permsJson,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        id
      );
    }

    res.json({ success: true, message: 'Data pengguna berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/users/:id - Delete user
router.delete('/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    if (user.username.toLowerCase() === 'administrator') {
      return res.status(400).json({ error: 'Akun Master Administrator tidak dapat dihapus!' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true, message: `Pengguna ${user.username} berhasil dihapus` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
