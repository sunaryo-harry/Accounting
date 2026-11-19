const express = require('express');
const router = express.Router();
const os = require('os');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { dbPath } = require('../db');

const upload = multer({ dest: path.join(__dirname, '..', '..', 'database', 'temp') });

// GET LAN Network Information
router.get('/lan-info', (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name]) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push({
            interface: name,
            ip: net.address,
            url: `http://${net.address}:4000`
          });
        }
      }
    }

    res.json({
      hostname: os.hostname(),
      platform: os.platform(),
      lanAddresses: addresses,
      port: 4000,
      localhostUrl: 'http://localhost:4000'
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
