const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;
const CTB_HOST = 'app.contabilium.com';
const CTB_BASE = 'https://app.contabilium.com/api'; // legacy

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CTB-Cookie',
  'Access-Control-Expose-Headers': 'X-CTB-Set-Cookie',
};

function sendJSON(res, status, data) {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function proxyRequest(req, res, targetPath, bodyOverride) {
  const ctbCookie = req.headers['x-ctb-cookie'] || '';
  const body = bodyOverride !== undefined ? bodyOverride : null;

  const options = {
    hostname: CTB_HOST,
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json, text/javascript, */*',
      'Origin': 'https://app.contabilium.com',
      'Referer': 'https://app.contabilium.com/',
      ...(ctbCookie ? { 'Cookie': ctbCookie } : {}),
      ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    let data = '';
    proxyRes.on('data', chunk => data += chunk);
    proxyRes.on('end', () => {
      const respHeaders = { ...CORS, 'Content-Type': 'application/json' };
      if (proxyRes.headers['set-cookie']) {
        respHeaders['X-CTB-Set-Cookie'] = proxyRes.headers['set-cookie'].join('; ');
      }
      res.writeHead(proxyRes.statusCode, respHeaders);
      res.end(data);
    });
  });

  proxyReq.on('error', (e) => sendJSON(res, 502, { error: e.message }));
  if (body) proxyReq.write(body);
  proxyReq.end();
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;
  const qs = parsed.search || '';

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }

  if (path === '/' || path === '/health') {
    sendJSON(res, 200, { status: 'ok', service: 'FEPA Proxy v2', timestamp: new Date().toISOString() });
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {

    // Endpoints web (sesión cookie) — los que encontramos en el Network
    if (path === '/web/comprobantes') {
      proxyRequest(req, res, '/comprobantes.aspx/getResults',
        body || JSON.stringify({ condicion: '', periodo: '365', fechaDesde: '', fechaHasta: '', page: 1, pageSize: 100 }));
      return;
    }
    if (path === '/web/ordenes') {
      proxyRequest(req, res, '/ordenventa.aspx/getResults',
        body || JSON.stringify({ condicion: '', periodo: '365', fechaDesde: '', fechaHasta: '', page: 1, pageSize: 100 }));
      return;
    }
    if (path === '/web/clientes') {
      proxyRequest(req, res, '/clientes.aspx/getResults',
        body || JSON.stringify({ condicion: '', page: 1, pageSize: 200 }));
      return;
    }

    // Proxy genérico para cualquier ruta
    proxyRequest(req, res, path + qs, body || null);
  });
});

server.listen(PORT, () => {
  console.log(`FEPA Proxy corriendo en puerto ${PORT}`);
  console.log(`Target: ${CTB_BASE}`);
});
