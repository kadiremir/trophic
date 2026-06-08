const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8081;
const DIST = path.join(__dirname, 'dist');
const BASE_PATH = '/trophic';

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  const requestPath = req.url || '/';
  const normalizedPath = requestPath.startsWith(BASE_PATH)
    ? requestPath.slice(BASE_PATH.length) || '/'
    : requestPath;
  let filePath = path.join(DIST, normalizedPath === '/' ? 'index.html' : normalizedPath);
  if (!fs.existsSync(filePath)) filePath = path.join(DIST, 'index.html');
  const ext = path.extname(filePath);
  res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
}).listen(PORT, () => console.log(`Serving on http://localhost:${PORT}`));
