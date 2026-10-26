// Shared HTTP server for the browser tests and render tools. The page itself (any path without a file extension,
// e.g. "/", "/live", "/?autoplay") is the test's patched index.html; every other path (vendor/three, game modules)
// is served from the repository, so tests run offline against the same files the game loads.
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const TYPES = { '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml' };

// page: the HTML string to serve, or (req) => HTML for tests that patch per request. Returns an unstarted server.
function gameServer(page) {
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://test').pathname);
    if (!path.extname(pathname) || pathname === '/index.html') {
      res.setHeader('Content-Type', TYPES['.html']);
      return res.end(typeof page === 'function' ? page(req) : page);
    }
    const file = path.join(root, pathname);
    if (!file.startsWith(root + path.sep)) { res.statusCode = 403; return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.statusCode = 404; return res.end(); }
      res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
      res.end(data);
    });
  });
}

module.exports = { gameServer, root };
