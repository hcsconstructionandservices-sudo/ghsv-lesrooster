const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const JSON_PATH = path.join(ROOT_DIR, 'promotie-media.json');
const IMG_DIR = path.join(ROOT_DIR, 'img');

if (!fs.existsSync(IMG_DIR)) {
  fs.mkdirSync(IMG_DIR, { recursive: true });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0'
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0'
  });
  res.end(text);
}

function sanitizeFilename(name) {
  const base = path.basename(name || 'upload.bin');
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  return safe || 'upload.bin';
}

function buildUploadPath(originalName) {
  const ext = path.extname(originalName || '');
  const safeName = sanitizeFilename(originalName);
  const uniqueName = `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;
  return path.join(IMG_DIR, uniqueName);
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.mp4': return 'video/mp4';
    case '.webm': return 'video/webm';
    case '.ogg': return 'video/ogg';
    default: return 'application/octet-stream';
  }
}

function serveStatic(res, requestPath) {
  let filePath = requestPath === '/' ? path.join(ROOT_DIR, 'index.html') : path.join(ROOT_DIR, requestPath.replace(/^\//, ''));
  if (!filePath.startsWith(ROOT_DIR)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      if (requestPath === '/') {
        sendText(res, 404, 'Not found');
        return;
      }
      const fallback = path.join(ROOT_DIR, 'index.html');
      fs.readFile(fallback, (fallbackError, content) => {
        if (fallbackError) {
          sendText(res, 404, 'Not found');
          return;
        }
        sendText(res, 200, content.toString('utf8'), 'text/html; charset=utf-8');
      });
      return;
    }

    fs.readFile(filePath, (readError, content) => {
      if (readError) {
        sendText(res, 500, 'Read error');
        return;
      }
      res.writeHead(200, {
        'Content-Type': getContentType(filePath),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0'
      });
      res.end(content);
    });
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = requestUrl.pathname;

  if (req.method === 'GET' && pathname === '/api/promo-media') {
    fs.readFile(JSON_PATH, 'utf8', (error, content) => {
      if (error) {
        sendJson(res, 404, { ok: false, error: 'No promo JSON yet.' });
        return;
      }
      try {
        sendJson(res, 200, JSON.parse(content));
      } catch (parseError) {
        sendJson(res, 500, { ok: false, error: 'Invalid promo JSON.' });
      }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/promo-media') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        fs.writeFile(JSON_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8', (writeError) => {
          if (writeError) {
            sendJson(res, 500, { ok: false, error: 'Could not write promo JSON.' });
            return;
          }
          sendJson(res, 200, { ok: true, path: 'promotie-media.json' });
        });
      } catch (parseError) {
        sendJson(res, 400, { ok: false, error: 'Invalid JSON body.' });
      }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/upload') {
    const originalName = req.headers['x-file-name'] || 'upload.bin';
    const targetPath = buildUploadPath(originalName);
    const chunks = [];

    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      fs.writeFile(targetPath, buffer, (writeError) => {
        if (writeError) {
          sendJson(res, 500, { ok: false, error: 'Could not save uploaded file.' });
          return;
        }
        const relativePath = path.relative(ROOT_DIR, targetPath).replace(/\\/g, '/');
        sendJson(res, 200, {
          ok: true,
          path: relativePath,
          url: `/${relativePath}`
        });
      });
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/health') {
    sendJson(res, 200, { ok: true, status: 'running' });
    return;
  }

  serveStatic(res, pathname);
});

server.listen(8000, '0.0.0.0', () => {
  console.log('Promo server listening on http://127.0.0.1:8000 and http://localhost:8000');
});
