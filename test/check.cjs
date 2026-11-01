// Schnelle Prüfung vor jedem Push/Deploy: node test/check.cjs
// 1. Baut die App ohne Beispieldaten. 2. Prüft, dass keine Beispiel- oder privaten Daten drin sind.
// 3. Prüft, dass das Skript fehlerfrei geladen werden kann. 4. Prüft den Abgleich-Server.
const fs = require("fs"), path = require("path"), { execSync } = require("child_process"), { pathToFileURL } = require("url");
const root = path.join(__dirname, ".."); let fehler = 0;
function ok(cond, text) { console.log((cond ? "✓ " : "✗ ") + text); if (!cond) fehler++; }

execSync("node build.cjs", { cwd: root, stdio: "pipe" });
const html = fs.readFileSync(path.join(root, "web/index.html"), "utf8");
ok(!html.includes("APP_DEMO ="), "keine Beispieldaten im veröffentlichten Build");
// Eigene Liste privater Begriffe (Namen, IBAN, …) in daten/verboten.txt – der Ordner daten/ ist nie im Repo
const vf = path.join(root, "daten/verboten.txt");
if (fs.existsSync(vf)) fs.readFileSync(vf, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  .forEach((w) => ok(!html.toLowerCase().includes(w.toLowerCase()), "kein privater Begriff „" + w.slice(0, 2) + "…“ im Build"));
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
scripts.forEach((s, i) => { try { new Function(s); ok(true, "Skript " + (i + 1) + " ohne Syntaxfehler"); } catch (e) { ok(false, "Skript " + (i + 1) + ": " + e.message); } });
["manifest.webmanifest", "sw.js", "icons/icon-192.png", "icons/apple-touch-icon.png"].forEach((f) => ok(fs.existsSync(path.join(root, "web", f)), "web/" + f + " vorhanden"));

(async () => {
  const fn = await import(pathToFileURL(path.join(root, "functions/api/sync/[id].js")).href);
  const store = new Map(), env = { SYNC_KV: { get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); } } };
  const id = "0123456789abcdef0123456789abcdef", tok = "t".repeat(40);
  const call = (method, body, token) => fn.onRequest({ env, params: { id }, request: new Request("http://x/api/sync/" + id, { method, headers: { "X-Sync-Token": token || tok }, body: body && JSON.stringify(body) }) });
  ok((await call("GET")).status === 404, "Abgleich: leer → 404");
  ok((await call("PUT", { v: 0, blob: { x: 1 } })).status === 200, "Abgleich: erstes Speichern");
  ok((await call("PUT", { v: 0, blob: { x: 2 } })).status === 409, "Abgleich: veralteter Stand → Konflikt");
  ok((await call("PUT", { v: 1, blob: { x: 3 } }, "f".repeat(40))).status === 403, "Abgleich: fremdes Token wird abgewiesen");
  console.log(fehler ? "\n" + fehler + " Fehler" : "\nAlles in Ordnung.");
  process.exit(fehler ? 1 : 0);
})();
