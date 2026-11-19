# Dokucheckliste PDok

Checkliste zur Aushebung der Pflegeprozessdokumentation (PDok) in Vanilla HTML/CSS/JS.
Erzeugt `Abschlussbericht.txt` aus den Eingaben. Kein Build, keine Abhängigkeiten.
Grundlage: `docs/Dokucheckliste_pdok_v3.docx`.

## Starten
**Am einfachsten:** `einzeldatei/Dokucheckliste_Variante_A.html` bzw. `…_B.html` öffnen – je eine Datei, alles eingebettet, funktioniert auch ohne Entpacken.
Nach Änderungen an `js/` oder `css/` neu erzeugen: `npm run build`.

Alternativ (ZIP **entpacken**!): `index.html` im Browser öffnen (Doppelklick genügt) und Variante wählen.

| Variante | Ordner | Für wen |
|----------|--------|---------|
| A – Schritt für Schritt | `variante-a-wizard/` | Seltene Nutzung, Einarbeitung, wenig Ablenkung |
| B – Formular mit Übersicht | `variante-b-formular/` | Routine, Korrekturen, Live-Vorschau des Berichts |

## Aufbau
```
css/style_CD.css       CI-Vorgaben (unverändert)
css/checkliste.css     Komponenten, nutzt nur CI-Variablen
js/logik.js            Entscheidungslogik + Berichtstext (ohne DOM, testbar)
js/bericht-speicher.js Ordnerzugriff bzw. Download
js/ui-bausteine.js     Render-Funktion je Frage (von beiden Varianten genutzt)
js/wizard.js           Variante A
js/formular.js         Variante B
tests/                 Unit-Tests (Logik) + Browser-Test (beide Varianten)
docs/ANALYSE.md        Gefundene Lücken/Widersprüche + Empfehlungen
```

## In ein bestehendes HTML+CSS-Projekt übernehmen
1. `css/checkliste.css` und die 4 Dateien aus `js/` (+ `wizard.js` **oder** `formular.js`) kopieren.
2. `style_CD.css` muss **vor** `checkliste.css` eingebunden sein.
3. Im Zielseiten-HTML ein `<div id="app"></div>` anlegen und die Skripte in dieser Reihenfolge einbinden:
   `logik.js`, `bericht-speicher.js`, `ui-bausteine.js`, `wizard.js`/`formular.js`.
4. Platzhalter in `js/logik.js` → `KONFIG` ersetzen (Explorer-Link, Ticket-System).

Alle CSS-Klassen beginnen mit `dc-` → keine Kollision mit bestehendem CSS.

## Tests
```
npm test                    # Logik (37 Tests)
npm run test:e2e            # Browser, benötigt Playwright
```

## Entscheidungsbaum
`docs/entscheidungsbaum/` – SVG, PNG, PDF und `.drawio` (bearbeitbar in draw.io; dort *Datei → Exportieren als → VSDX* für Visio).
Neu erzeugen: `python3 tools/entscheidungsbaum.py`.
