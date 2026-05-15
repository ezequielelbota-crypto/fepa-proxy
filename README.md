# FEPA Proxy — Contabilium CORS Bridge

Servidor proxy liviano que resuelve el bloqueo CORS del browser al conectar con la API de Contabilium.

## Deploy en Railway (gratis, 5 minutos)

### Opción A — Railway CLI (más rápido)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Opción B — GitHub + Railway Dashboard
1. Subir esta carpeta a un repo GitHub
2. Ir a railway.app → New Project → Deploy from GitHub
3. Seleccionar el repo → Deploy
4. Copiar la URL que genera Railway (ej: `https://fepa-proxy-production.up.railway.app`)

## Configurar en FEPA

En el archivo fepa-completo-v4.html, buscar la línea:
```js
const CTB_PROXY_CUSTOM = '';
```
Y cambiarla por:
```js
const CTB_PROXY_CUSTOM = 'https://TU-URL.up.railway.app/api';
```

## Cómo funciona

El proxy recibe requests del browser con CORS permisivo, y los reenvía a app.contabilium.com
usando Node.js del lado del servidor (sin restricciones CORS).

Ejemplo:
- Browser → `https://tu-proxy.up.railway.app/api/clientes?api_key=XXX`
- Proxy → `https://app.contabilium.com/api/clientes?api_key=XXX`
- Respuesta → vuelve al browser con headers CORS correctos
