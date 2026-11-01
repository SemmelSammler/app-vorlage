// Klick-Test wie ein Mensch: node test/klicktest.cjs
// Startet den Testserver, öffnet die App als „Computer“ und als „iPhone“, trägt etwas ein, richtet den Abgleich ein
// und prüft, dass der Eintrag auf dem anderen Gerät ankommt. Screenshots landen in test/bilder/.
const { chromium, devices } = require("playwright"), { spawn, execSync } = require("child_process"), path = require("path"), fs = require("fs");
const root = path.join(__dirname, ".."), port = 8799, url = "http://localhost:" + port + "/";
(async () => {
  execSync("node build.cjs", { cwd: root, stdio: "pipe" });
  const srv = spawn("node", ["tools/server.mjs", String(port)], { cwd: root, stdio: "pipe" });
  await new Promise((r) => srv.stdout.once("data", r));
  const out = path.join(__dirname, "bilder"); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(), fehler = [];
  try {
    const pc = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
    const ph = await (await b.newContext({ ...devices["iPhone 13"], colorScheme: "dark" })).newPage();
    for (const p of [pc, ph]) p.on("pageerror", (e) => fehler.push(e.message));
    await pc.goto(url); await pc.click('button:text-is("Loslegen")');
    await pc.click('button:text-is("Neu eintragen")'); await pc.fill("#f-text", "Test-Eintrag"); await pc.fill("#f-betrag", "-12,50"); await pc.click('button:text-is("Speichern")');
    await pc.click(".nav >> text=Mehr"); await pc.click('button:text-is("Neu einrichten")');
    const key = (await pc.locator(".key").innerText()).trim();
    await pc.waitForTimeout(3500);   // Abgleich läuft 3 s nach der letzten Änderung
    await pc.screenshot({ path: path.join(out, "computer.png") });
    await ph.goto(url); await ph.click('button:text-is("Mit Schlüssel verbinden")'); await ph.fill("#f-key", key.toLowerCase()); await ph.click('button:text-is("Verbinden")');
    await ph.waitForSelector("text=Test-Eintrag", { timeout: 8000 });
    await ph.screenshot({ path: path.join(out, "iphone.png") });
    console.log("✓ Eintrag vom Computer ist auf dem iPhone angekommen");
  } catch (e) { fehler.push(e.message); }
  await b.close(); srv.kill();
  console.log(fehler.length ? "✗ " + fehler.join("\n✗ ") : "✓ keine Fehler. Bilder: test/bilder/");
  process.exit(fehler.length ? 1 : 0);
})();
