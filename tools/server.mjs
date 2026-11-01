// Lokaler Testserver: node tools/server.mjs [port]
// Liefert web/ aus und spielt den Abgleich-Server (functions/api/sync) mit einem Speicher im Arbeitsspeicher nach.
// So lässt sich alles (auch der Abgleich zwischen zwei „Geräten“) ohne Cloudflare testen.
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fn = await import(pathToFileURL(path.join(root, "functions/api/sync/[id].js")).href);
const store = new Map();
const env = { SYNC_KV: { get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); } } };
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml" };
const port = +process.argv[2] || 8788;
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  const m = u.pathname.match(/^\/api\/sync\/([^/]+)$/);
  if (m) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const request = new Request("http://localhost" + req.url, { method: req.method, headers: req.headers, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const r = await fn.onRequest({ request, env, params: { id: m[1] } });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  const p = path.join(root, "web", u.pathname === "/" ? "index.html" : decodeURIComponent(u.pathname));
  if (!p.startsWith(path.join(root, "web")) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
}).listen(port, () => console.log("Testserver: http://localhost:" + port));
