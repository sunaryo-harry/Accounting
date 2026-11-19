const express = require('express');
const router = express.Router();
const os = require('os');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db, dbPath } = require('../db');

const upload = multer({ dest: path.join(__dirname, '..', '..', 'database', 'temp') });

// Helper to get LAN config from system_settings or config file
function getLanConfig() {
  const configFile = path.join(__dirname, '..', 'lan-config.json');
  let fileConfig = {};
  if (fs.existsSync(configFile)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    } catch (e) {}
  }

  const portRow = db.prepare(`SELECT value FROM system_settings WHERE key = 'lan_port'`).get();
  const hostRow = db.prepare(`SELECT value FROM system_settings WHERE key = 'lan_host'`).get();
  const aliasRow = db.prepare(`SELECT value FROM system_settings WHERE key = 'lan_alias'`).get();
  const modeRow = db.prepare(`SELECT value FROM system_settings WHERE key = 'lan_mode'`).get();

  const port = parseInt(portRow?.value || fileConfig.port || process.env.PORT || 4000);
  const host = hostRow?.value || fileConfig.host || '0.0.0.0';
  const alias = aliasRow?.value || fileConfig.alias || '';
  const mode = modeRow?.value || fileConfig.mode || 'OPEN';

  return { port, host, alias, mode };
}

// GET LAN Network Information
router.get('/lan-info', (req, res) => {
  try {
    const { port, host, alias, mode } = getLanConfig();
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name]) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push({
            interface: name,
            ip: net.address,
            url: `http://${net.address}:${port}`
          });
        }
      }
    }

    res.json({
      hostname: os.hostname(),
      platform: os.platform(),
      lanAddresses: addresses,
      port,
      host,
      alias,
      mode,
      localhostUrl: `http://localhost:${port}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /lan-config - Edit LAN Access Configuration
router.post('/lan-config', (req, res) => {
  try {
    const { port, host, alias, mode } = req.body;
    const cleanPort = parseInt(port) || 4000;
    const cleanHost = host ? String(host).trim() : '0.0.0.0';
    const cleanAlias = alias ? String(alias).trim() : '';
    const cleanMode = mode || 'OPEN';

    if (cleanPort < 80 || cleanPort > 65535) {
      return res.status(400).json({ error: 'Nomor Port LAN harus antara 80 dan 65535' });
    }

    // Save to system_settings in SQLite
    const setStmt = db.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)`);
    setStmt.run('lan_port', String(cleanPort));
    setStmt.run('lan_host', cleanHost);
    setStmt.run('lan_alias', cleanAlias);
    setStmt.run('lan_mode', cleanMode);

    // Also persist to lan-config.json
    const configFile = path.join(__dirname, '..', 'lan-config.json');
    fs.writeFileSync(configFile, JSON.stringify({
      port: cleanPort,
      host: cleanHost,
      alias: cleanAlias,
      mode: cleanMode,
      updatedAt: new Date().toISOString()
    }, null, 2), 'utf-8');

    res.json({
      success: true,
      message: `Konfigurasi Server LAN berhasil disimpan! Port: ${cleanPort}, Host: ${cleanHost}. Server aktif mendengarkan koneksi jaringan.`,
      config: { port: cleanPort, host: cleanHost, alias: cleanAlias, mode: cleanMode }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Database Backup File (Download accounting.sqlite)
router.get('/download-database', (req, res) => {
  try {
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Database file not found' });
    }
    const timestamp = new Date().toISOString().slice(0, 10);
    res.download(dbPath, `Accounting-Enterprise-Backup-${timestamp}.sqlite`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
