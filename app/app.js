/* App-Vorlage. Die Beispiel-Funktion („Einträge“) ist Platzhalter: durch die eigene Idee ersetzen.
   Fest eingebaut und meist unverändert übernehmen: Speichern, Backup, Abgleich, Handy-Ansicht, Desktop-Anbindung. */
(function () {
  "use strict";
  var CFG = window.APP_CONFIG || { name: "App", id: "app", server: "" };
  var STORE = CFG.id + ".daten.v1", SYNC_CFG = CFG.id + ".sync", UI_STORE = CFG.id + ".ui";
  var DEMO = window.APP_DEMO || null;   // nur im lokalen Build mit --demo vorhanden

  /* ================= Hilfen ================= */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function eur(v) { return (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; }
  function heute() { return new Date().toISOString().slice(0, 10); }
  function datum(d) { var x = new Date(d + "T12:00:00"); return isNaN(x) ? "" : x.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function zahl(s) { var n = parseFloat(String(s || "").replace(/\./g, "").replace(",", ".")); return isNaN(n) ? null : n; }

  /* ================= Daten ================= */
  function leer() { return { version: 1, eintraege: [] }; }
  var state = (function () { try { return JSON.parse(localStorage.getItem(STORE)); } catch (e) { return null; } })();
  var neu = !state;
  if (!state) state = DEMO ? clone(DEMO) : leer();
  var ui = (function () { try { return JSON.parse(localStorage.getItem(UI_STORE)) || {}; } catch (e) { return {}; } })();
  ui.view = ui.view || "start"; ui.modal = neu ? { type: "willkommen" } : null; ui.toast = null;
  var saveErr = null;
  function save() {
    var json = JSON.stringify(state);
    try { localStorage.setItem(STORE, json); saveErr = null; } catch (e) { saveErr = e.message; }
    try { localStorage.setItem(UI_STORE, JSON.stringify({ view: ui.view, mode: ui.mode })); } catch (e) {}
    syncChanged(json);
  }
  function toast(t) { ui.toast = t; render(); clearTimeout(toast.t); toast.t = setTimeout(function () { ui.toast = null; render(); }, 2600); }

  /* ================= Handy oder Desktop ================= */
  var PHONE = window.matchMedia("(max-width: 700px)");
  function isPhone() { return PHONE.matches; }
  PHONE.addEventListener("change", function () { render(); });
  function setMode() { document.documentElement.dataset.mode = ui.mode && ui.mode !== "system" ? ui.mode : ""; }

  /* ================= Beispiel-Funktion: Einträge ================= */
  function summe() { return state.eintraege.reduce(function (s, e) { return s + e.betrag; }, 0); }
  function viewStart() {
    var list = state.eintraege.slice().sort(function (a, b) { return a.datum < b.datum ? 1 : -1; });
    var head = '<div class="head"><div><h1>Übersicht</h1><p class="cap">' + list.length + (list.length === 1 ? " Eintrag" : " Einträge") + "</p></div>" +
      (isPhone() ? "" : '<button class="btn primary" data-act="neu">Neu eintragen</button>') + "</div>";
    var hero = '<section class="card hero"><span class="lab">Summe</span><span class="big num' + (summe() < 0 ? " neg" : "") + '">' + eur(summe()) + "</span></section>";
    var rows = list.length ? '<ul class="list">' + list.map(function (e) {
      return '<li><button class="grow" data-act="bearbeiten" data-id="' + e.id + '"><span class="t">' + esc(e.text) + '</span><span class="s">' + esc(datum(e.datum)) + '</span></button><span class="amt num' + (e.betrag < 0 ? " neg" : " pos") + '">' + eur(e.betrag) + "</span></li>";
    }).join("") + "</ul>" : '<div class="card empty">Noch nichts eingetragen. Tipp auf „+“.</div>';
    return head + hero + '<h2 class="h2">Einträge</h2>' + rows;
  }
  function eintragForm(e) {
    return '<div class="stack"><label class="field">Wofür<input id="f-text" value="' + esc(e ? e.text : "") + '" autocomplete="off"></label>' +
      '<label class="field">Betrag (minus = Ausgabe)<input id="f-betrag" inputmode="decimal" value="' + (e ? String(e.betrag).replace(".", ",") : "") + '"></label>' +
      '<label class="field">Datum<input id="f-datum" type="date" value="' + (e ? e.datum : heute()) + '"></label></div>';
  }
  function eintragSpeichern() {
    var t = document.getElementById("f-text").value.trim(), b = zahl(document.getElementById("f-betrag").value), d = document.getElementById("f-datum").value || heute();
    if (!t || b == null) { toast("Bitte Text und Betrag eintragen."); return; }
    var id = ui.modal.id;
    if (id) { var e = state.eintraege.find(function (x) { return x.id === id; }); e.text = t; e.betrag = b; e.datum = d; }
    else state.eintraege.push({ id: uid(), text: t, betrag: b, datum: d });
    ui.modal = null; save(); toast(id ? "Geändert." : "Eingetragen.");
  }

  /* ================= Mehr: Backup, Abgleich, Darstellung ================= */
  function viewMehr() {
    var mode = ui.mode || "system";
    return '<div class="head"><div><h1>Mehr</h1></div></div>' +
      '<section class="card stack"><h2 class="h2" style="margin:0">Darstellung</h2><div class="seg">' +
      [["system", "System"], ["hell", "Hell"], ["dunkel", "Dunkel"]].map(function (m) { return '<button class="' + (mode === m[0] ? "on" : "") + '" data-act="mode" data-m="' + m[0] + '">' + m[1] + "</button>"; }).join("") + "</div></section>" +
      syncCard() +
      '<section class="card stack"><h2 class="h2" style="margin:0">Backup</h2><p class="muted" style="margin:0">Deine Daten liegen auf diesem Gerät. Ein Backup ist eine Datei, die du sicher ablegst.</p>' +
      '<div class="btn-row"><button class="btn primary" data-act="backupSpeichern">Backup speichern</button><button class="btn" data-act="backupLaden">Backup laden</button></div>' +
      (saveErr ? '<p class="neg" style="margin:0">Speichern hat nicht geklappt: ' + esc(saveErr) + "</p>" : "") + "</section>";
  }
  var TAURI = window.__TAURI__ && window.__TAURI__.core ? window.__TAURI__ : null;
  function backupSpeichern() {
    var name = CFG.id + "-backup-" + heute() + ".json", text = JSON.stringify(state, null, 1);
    if (TAURI) { TAURI.core.invoke("save_file_dialog", { contents: text, defaultName: name }).then(function (p) { if (p) toast("Backup gespeichert."); }, function (e) { toast("Nicht gespeichert: " + e); }); return; }
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast("Backup wird gespeichert (Ordner Downloads).");
  }
  var backupIn = document.createElement("input"); backupIn.type = "file"; backupIn.accept = ".json,application/json"; backupIn.hidden = true; document.body.appendChild(backupIn);
  backupIn.addEventListener("change", function () {
    var f = backupIn.files[0]; backupIn.value = ""; if (!f) return;
    f.text().then(function (t) { var d = JSON.parse(t); if (!d || !Array.isArray(d.eintraege)) throw new Error("Das ist kein Backup dieser App."); state = d; ui.modal = null; save(); toast("Backup geladen."); })
      .catch(function (e) { toast("Nicht geladen: " + e.message); });
  });

  /* ================= Abgleich zwischen Geräten (verschlüsselt) ================= */
  var SY = window.AppSync;
  var syncCfg = (function () { try { return JSON.parse(localStorage.getItem(SYNC_CFG)) || {}; } catch (e) { return {}; } })();
  var syncRun = { busy: false, err: null, timer: null, pending: null };
  // Läuft die App auf dem Server selbst (Web/iPhone), geht der Abgleich an dieselbe Adresse; Desktop-App an CFG.server
  var sameOrigin = /^https?:$/.test(location.protocol) && location.hostname !== "tauri.localhost";
  function server() { return syncCfg.server || (sameOrigin ? "" : CFG.server || ""); }
  function syncSaveCfg() { try { localStorage.setItem(SYNC_CFG, JSON.stringify(syncCfg)); } catch (e) {} }
  function syncReady() { return !!(SY && syncCfg.key && (sameOrigin || server())); }
  function syncChanged(json) {
    var h = SY && SY.hash(json);
    if (!syncReady() || h === syncCfg.hash || h === syncRun.pending) return;   // Neuzeichnen ohne Änderung verschiebt nichts
    syncRun.pending = h; clearTimeout(syncRun.timer); syncRun.timer = setTimeout(function () { syncRun.pending = null; syncPush(); }, 3000);
  }
  function syncPush() {
    if (!syncReady() || syncRun.busy) return;
    var json = JSON.stringify(state); if (SY.hash(json) === syncCfg.hash) return;
    syncRun.busy = true;
    SY.push(server(), syncCfg.key, syncCfg.v || 0, JSON.parse(json)).then(function (r) {
      syncRun.busy = false; syncRun.err = null;
      if (r.ok) { syncCfg.v = r.v; syncCfg.at = r.at; syncCfg.hash = SY.hash(json); syncSaveCfg(); if (ui.view === "mehr") render(); return; }
      if (r.conflict) { ui.modal = { type: "konflikt", remote: r.remote }; render(); }
    }, function (e) { syncRun.busy = false; syncRun.err = e.message; if (ui.view === "mehr") render(); });
  }
  function syncPull(manuell) {
    if (!syncReady() || syncRun.busy) return;
    syncRun.busy = true;
    SY.pull(server(), syncCfg.key).then(function (r) {
      syncRun.busy = false; syncRun.err = null;
      var lokalGeaendert = SY.hash(JSON.stringify(state)) !== syncCfg.hash;
      if (!r) { syncPush(); return; }
      if (r.v === syncCfg.v) { if (lokalGeaendert) syncPush(); else if (manuell) toast("Alles aktuell."); return; }
      if (!lokalGeaendert) { syncApply(r); if (manuell) toast("Neuer Stand geladen."); return; }
      ui.modal = { type: "konflikt", remote: r }; render();
    }, function (e) { syncRun.busy = false; syncRun.err = e.message; if (manuell) toast("Abgleich: " + e.message); });
  }
  function syncApply(r) { state = r.data; syncCfg.v = r.v; syncCfg.at = r.at; syncCfg.hash = SY.hash(JSON.stringify(state)); syncSaveCfg(); try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} render(); }
  function syncCard() {
    var inner;
    if (!syncCfg.key) inner = '<p class="muted" style="margin:0">Gleiche deine Daten verschlüsselt zwischen Handy und Computer ab. Nur wer den Schlüssel hat, kann sie lesen.</p>' +
      '<div class="btn-row"><button class="btn primary" data-act="syncNeu">Neu einrichten</button><button class="btn" data-act="syncVerbinden">Mit Schlüssel verbinden</button></div>';
    else inner = '<p class="muted" style="margin:0">' + (syncRun.err ? '<span class="neg">Fehler: ' + esc(syncRun.err) + "</span>" : syncCfg.at ? "Zuletzt abgeglichen: " + new Date(syncCfg.at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "Noch nicht abgeglichen.") + "</p>" +
      (ui.zeigeKey ? '<div class="key">' + esc(syncCfg.key) + "</div>" : "") +
      '<div class="btn-row"><button class="btn primary" data-act="syncJetzt">Jetzt abgleichen</button><button class="btn" data-act="syncKey">' + (ui.zeigeKey ? "Schlüssel verbergen" : "Schlüssel zeigen") + '</button><button class="btn ghost" data-act="syncAus">Trennen</button></div>';
    var srv = sameOrigin ? "" : '<label class="field">Server<input id="f-server" value="' + esc(syncCfg.server || "") + '" placeholder="' + esc(CFG.server || "https://meine-app.pages.dev") + '" autocomplete="off" spellcheck="false"></label>';
    return '<section class="card stack"><h2 class="h2" style="margin:0">Abgleich zwischen Geräten</h2>' + inner + srv + "</section>";
  }

  /* ================= Fenster ================= */
  function modal() {
    var m = ui.modal; if (!m) return "";
    var body = "";
    if (m.type === "willkommen") body = "<h2>Willkommen bei " + esc(CFG.name) + "</h2><p>Schon auf einem anderen Gerät eingerichtet? Dann verbinde dich mit deinem Schlüssel.</p>" +
      '<div class="btn-row"><button class="btn primary" data-act="los">Loslegen</button><button class="btn" data-act="syncVerbinden">Mit Schlüssel verbinden</button><button class="btn ghost" data-act="backupLaden">Backup laden</button></div>';
    if (m.type === "eintrag") body = "<h2>" + (m.id ? "Eintrag ändern" : "Neu eintragen") + "</h2>" + eintragForm(m.id && state.eintraege.find(function (x) { return x.id === m.id; })) +
      '<div class="btn-row"><button class="btn primary" data-act="eintragSpeichern">Speichern</button><button class="btn" data-act="zu">Abbrechen</button>' + (m.id ? '<button class="btn ghost" data-act="eintragLoeschen">Löschen</button>' : "") + "</div>";
    if (m.type === "syncVerbinden") body = "<h2>Mit Schlüssel verbinden</h2><p>Den Schlüssel findest du auf dem anderen Gerät unter Mehr → Abgleich.</p>" +
      '<label class="field">Schlüssel<input id="f-key" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>' +
      (sameOrigin ? "" : '<label class="field">Server<input id="f-server2" value="' + esc(server()) + '" autocomplete="off" spellcheck="false"></label>') +
      '<div class="btn-row"><button class="btn primary" data-act="syncVerbindenOk">Verbinden</button><button class="btn" data-act="zu">Abbrechen</button></div>';
    if (m.type === "konflikt") body = "<h2>Zwei verschiedene Stände</h2><p>Auf einem anderen Gerät wurde auch etwas geändert. Welcher Stand soll gelten?</p>" +
      '<div class="btn-row"><button class="btn primary" data-act="konfliktDort">Stand vom anderen Gerät</button><button class="btn" data-act="konfliktHier">Meine Version behalten</button></div>';
    return '<div class="overlay" data-act="' + (m.type === "konflikt" ? "" : "zuHintergrund") + '"><div class="modal" role="dialog" aria-modal="true">' + body + "</div></div>";
  }

  /* ================= Zeichnen ================= */
  var VIEWS = [["start", "Übersicht"], ["mehr", "Mehr"]];
  function render() {
    setMode();
    document.documentElement.classList.toggle("is-phone", isPhone());
    var main = ui.view === "mehr" ? viewMehr() : viewStart();
    var html = isPhone()
      ? '<div class="notch"></div><main class="main">' + main + '</main><nav class="tabbar">' +
        '<button class="' + (ui.view === "start" ? "on" : "") + '" data-act="view" data-v="start">' + ICON.home + "Übersicht</button>" +
        '<button class="plus" data-act="neu" aria-label="Neu eintragen">+</button>' +
        '<button class="' + (ui.view === "mehr" ? "on" : "") + '" data-act="view" data-v="mehr">' + ICON.mehr + "Mehr</button></nav>"
      : '<header class="top"><div class="brand"><img src="icons/icon-192.png" alt="">' + esc(CFG.name) + '</div><nav class="nav">' +
        VIEWS.map(function (v) { return '<button class="' + (ui.view === v[0] ? "on" : "") + '" data-act="view" data-v="' + v[0] + '">' + v[1] + "</button>"; }).join("") + "</nav></header>" +
        '<main class="main">' + main + "</main>";
    var focus = document.activeElement && document.activeElement.id, vals = {};
    document.querySelectorAll("input[id]").forEach(function (i) { vals[i.id] = i.value; });
    document.getElementById("app").innerHTML = html + modal() + (ui.toast ? '<div class="toast" role="status">' + esc(ui.toast) + "</div>" : "");
    Object.keys(vals).forEach(function (id) { var i = document.getElementById(id); if (i && i.type !== "file") i.value = vals[id]; });   // Eingaben überleben das Neuzeichnen
    if (focus && document.getElementById(focus)) document.getElementById(focus).focus();
  }
  var ICON = {
    home: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    mehr: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'
  };

  /* ================= Klicks ================= */
  document.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-act]"); if (!el) return;
    var a = el.dataset.act, d = el.dataset;
    if (a === "zuHintergrund") { if (ev.target === el) { ui.modal = null; render(); } return; }
    if (a === "view") { ui.view = d.v; ui.modal = null; window.scrollTo(0, 0); save(); render(); return; }
    if (a === "zu" || a === "los") { ui.modal = null; if (a === "los") save(); render(); return; }
    if (a === "neu") { ui.modal = { type: "eintrag" }; render(); var t = document.getElementById("f-text"); if (t && !isPhone()) t.focus(); return; }
    if (a === "bearbeiten") { ui.modal = { type: "eintrag", id: d.id }; render(); return; }
    if (a === "eintragSpeichern") { eintragSpeichern(); return; }
    if (a === "eintragLoeschen") { state.eintraege = state.eintraege.filter(function (x) { return x.id !== ui.modal.id; }); ui.modal = null; save(); toast("Gelöscht."); return; }
    if (a === "mode") { ui.mode = d.m; save(); render(); return; }
    if (a === "backupSpeichern") { backupSpeichern(); return; }
    if (a === "backupLaden") { backupIn.click(); return; }
    if (a === "syncNeu") {
      var s1 = document.getElementById("f-server"); if (s1) syncCfg.server = s1.value.trim().replace(/\/+$/, "");
      if (!sameOrigin && !server()) { toast("Bitte die Server-Adresse eintragen."); return; }
      syncCfg = { key: SY.newKey(), server: syncCfg.server, v: 0 }; syncSaveCfg(); ui.zeigeKey = true; save(); syncPush(); render(); toast("Eingerichtet. Schlüssel gut aufbewahren!"); return;
    }
    if (a === "syncVerbinden") { ui.modal = { type: "syncVerbinden" }; render(); return; }
    if (a === "syncVerbindenOk") {
      var key = document.getElementById("f-key").value, s2 = document.getElementById("f-server2");
      if (s2) syncCfg.server = s2.value.trim().replace(/\/+$/, "");
      if (!SY.valid(key)) { toast("Der Schlüssel hat 20 Zeichen, z. B. ABCD-EFGH-…"); return; }
      if (!sameOrigin && !server()) { toast("Bitte die Server-Adresse eintragen."); return; }
      SY.pull(server(), key).then(function (r) {
        syncCfg = { key: SY.pretty(key), server: syncCfg.server, v: 0 }; ui.modal = null;
        if (r) { syncApply(r); toast("Verbunden. Deine Daten sind da."); } else { syncSaveCfg(); save(); syncPush(); toast("Verbunden."); }
      }, function (e) { toast(e.message); });
      return;
    }
    if (a === "syncJetzt") { syncPull(true); return; }
    if (a === "syncKey") { ui.zeigeKey = !ui.zeigeKey; render(); return; }
    if (a === "syncAus") { syncCfg = { server: syncCfg.server }; syncSaveCfg(); ui.zeigeKey = false; render(); toast("Abgleich auf diesem Gerät beendet."); return; }
    if (a === "konfliktDort") { var r = ui.modal.remote; ui.modal = null; syncApply(r); toast("Stand vom anderen Gerät übernommen."); return; }
    if (a === "konfliktHier") { syncCfg.v = ui.modal.remote.v; syncCfg.hash = null; ui.modal = null; syncSaveCfg(); syncPush(); render(); return; }
  });
  document.addEventListener("change", function (ev) {
    if (ev.target.id === "f-server") { syncCfg.server = ev.target.value.trim().replace(/\/+$/, ""); syncSaveCfg(); }
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && ui.modal && ui.modal.type !== "konflikt") { ui.modal = null; render(); }
    if (ev.key === "Enter" && ui.modal && ui.modal.type === "eintrag" && ev.target.tagName === "INPUT") eintragSpeichern();
  });

  render();
  setTimeout(function () { syncPull(); }, 400);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) syncPull(); });
  setInterval(function () { if (!document.hidden) syncPull(); }, 120000);
})();
