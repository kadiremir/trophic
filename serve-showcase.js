const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8082;

http.createServer((req, res) => {
  const name = path.basename(req.url.split('?')[0]) || 'popup-showcase-d5-colors.html';
  const file = path.join(__dirname, name.endsWith('.html') ? name : 'popup-showcase-d5-colors.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`Showcase running at http://localhost:${PORT}`);
});
