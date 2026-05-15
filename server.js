const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;
const CTB_BASE = 'https://app.contabilium.com/api';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

function proxyRequest(req, res, targetPath) {
  const parsed = url.parse(CTB_BASE + targetPath, true);
  const options = {
    hostname: parsed.hostname,
    port: 443,
    path: parsed.path,
    method: req.method,
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'FEPA-Proxy/1.0' },
  };
  const proxyReq = https.request(options, (proxyRes) => {
    let body = '';
    proxyRes.on('data', chunk => body += chunk);
    proxyRes.on('end', () => { res.writeHead(proxyRes.statusCode, CORS); res.end(body); });
  });
  proxyReq.on('error', (e) => { res.writeHead(502, CORS); res.end(JSON.stringify({ error: e.message })); });
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
  const qs = parsed.search || '';

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  if (path === '/' || path === '/health') {
    res.writeHead(200, CORS);
    res.end(JSON.stringify({ status: 'ok', service: 'FEPA Proxy' }));
    return;
  }

  // /api/clientes?... → /clientes?...
  let ctbPath = path.replace(/^\/api/, '') + qs;
  if (!ctbPath.startsWith('/')) ctbPath = '/' + ctbPath;
  proxyRequest(req, res, ctbPath);
});

server.listen(PORT, () => console.log('FEPA Proxy en puerto ' + PORT));
