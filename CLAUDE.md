# Hinweise für Claude

- Sprache: Deutsch. Antworten **kurz**, einfache Worte, genaue Klick-Anleitungen, am Ende Stichpunkte oder Tabelle. Der Nutzer ist Anfänger.
- Widerspruch ist erwünscht – begründet, nie still abweichen.
- Ablauf und Stolperfallen: Skill `app-von-idee-bis-geraet` (liegt in `.claude/skills/`).
- **Keine echten Daten** in Code, Commits oder Build. Beispieldaten nur in `app/beispiel.js` (nur mit `--demo`).
- Gestaltung nur über `app/tokens.css`. Kein `!important`. Alles muss auf einen Bildschirm passen, sauber ausgerichtet, auch am iPhone mit Notch.
- Vor jedem Push: `node test/check.cjs`, bei Oberflächen-Änderungen zusätzlich `node test/klicktest.cjs` und die Bilder in `test/bilder/` ansehen.
- Vor größeren Design-Schritten: 2–4 Varianten als Artefakt zeigen und wählen lassen.
- Speicher-Schlüssel (`<id>.daten.v1`, `<id>.sync`) und `id` in `app.config.json` nach dem ersten echten Einsatz **nie mehr ändern** – sonst sind Daten und Abgleich weg.
