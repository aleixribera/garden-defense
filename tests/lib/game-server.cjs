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

// Where tests save their renders / screenshots: docs/ only with DOC_RENDERS=1 (refreshing the committed images),
// otherwise tests/.logs/renders, so a normal test run leaves the working tree clean.
function renderDir() {
  const dir = process.env.DOC_RENDERS ? path.join(root, 'docs') : path.join(__dirname, '..', '.logs', 'renders');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Chromium WebGL flags for every test browser. On Linux with a GPU render node (the test laptop) WebGL runs on the GPU
// (ANGLE on Vulkan): boot and frames cost ~5x less CPU than software SwiftShader, which every machine without a GPU
// (CI) falls back to. TEST_GL=swiftshader forces software rendering, TEST_GL=gpu forces the GPU flags.
function glArgs(extra = []) {
  const mode = process.env.TEST_GL || (process.platform === 'linux' && fs.existsSync('/dev/dri/renderD128') ? 'gpu' : 'swiftshader');
  const gl = mode === 'gpu' ? ['--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  return [...gl, ...extra];
}

module.exports = { gameServer, root, renderDir, glArgs };
