const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;
const CTB_BASE = 'https://app.contabilium.com/api';

// CORS headers — permite requests desde cualquier origen (el browser de FEPA)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

function sendJSON(res, status, data) {
  res.writeHead(status, CORS);
  res.end(JSON.stringify(data));
}

function proxyRequest(req, res, targetPath) {
  const parsed = url.parse(CTB_BASE + targetPath, true);
  const options = {
    hostname: parsed.hostname,
    port: 443,
    path: parsed.path,
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FEPA-Proxy/1.0',
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    let body = '';
    proxyRes.on('data', chunk => body += chunk);
    proxyRes.on('end', () => {
      res.writeHead(proxyRes.statusCode, CORS);
      res.end(body);
    });
  });

  proxyReq.on('error', (e) => {
    sendJSON(res, 502, { error: 'Proxy error: ' + e.message });
  });

  // Forward body para POST/PUT
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => proxyReq.end(body));
  } else {
    proxyReq.end();
  }
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // Health check
  if (path === '/' || path === '/health') {
    sendJSON(res, 200, { status: 'ok', service: 'FEPA Proxy', timestamp: new Date().toISOString() });
    return;
  }

  // Proxy todo hacia Contabilium — acepta /api/clientes, /clientes, etc.
  // FEPA manda: /api/clientes?api_key=XXX&page=1
  // Contabilium espera: /clientes?api_key=XXX&page=1
  let ctbPath = path;
  if (ctbPath.startsWith('/api')) {
    ctbPath = ctbPath.replace(/^\/api/, '') || '/';
  }
  // Agregar query string
  ctbPath = ctbPath + (parsed.search || '');
  proxyRequest(req, res, ctbPath);
});

server.listen(PORT, () => {
  console.log(`FEPA Proxy corriendo en puerto ${PORT}`);
  console.log(`Target: ${CTB_BASE}`);
});
