const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { seedDatabase } = require('./seed');

// Initialize database schema and seeds
seedDatabase();

// Load LAN config if exists
let configuredPort = 4000;
let configuredHost = '0.0.0.0';
const lanConfigFile = path.join(__dirname, 'lan-config.json');
if (fs.existsSync(lanConfigFile)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(lanConfigFile, 'utf-8'));
    if (cfg.port) configuredPort = parseInt(cfg.port);
    if (cfg.host) configuredHost = cfg.host;
  } catch (e) {}
}

const app = express();
const PORT = process.env.PORT || configuredPort;
const HOST = process.env.HOST || configuredHost;

// Enable Cross-Origin & JSON Parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded proof files & attachments
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Serve frontend single-page application
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/entities', require('./routes/entities').router);
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/journals', require('./routes/journals'));
app.use('/api/general-ledger', require('./routes/generalLedger'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/rp', require('./routes/receivablesPayables'));
app.use('/api/assets', require('./routes/fixedAssets'));
app.use('/api/taxes', require('./routes/taxes'));
app.use('/api/psak46', require('./routes/fiscalPsak46'));
app.use('/api/spt1771', require('./routes/spt1771'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/system', require('./routes/backup'));

// Fallback to SPA index.html for client-side navigation
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
  next();
});

// Bind to 0.0.0.0 to enable LAN access
const server = app.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`  APLIKASI AKUNTANSI ENTERPRISE MULTI ENTITAS`);
  console.log(`  Gaya Visual: DJP Coretax Indonesia`);
  console.log(`  Credit by Harry Sunaryo`);
  console.log(`=======================================================`);
  console.log(`  Server Lokal:  http://localhost:${PORT}`);

  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  Server LAN:    http://${net.address}:${PORT}`);
      }
    }
  }
  console.log(`=======================================================`);
  console.log(`  Aplikasi siap digunakan di jaringan lokal (LAN)!`);
  console.log(`=======================================================`);
});

module.exports = { app, server };
