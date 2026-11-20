// Erzeugt je Variante EINE HTML-Datei mit eingebettetem CSS und JS.
// Vorteil: funktioniert auch ohne Entpacken / ohne Ordnerstruktur (z. B. Mail-Anhang, ZIP-Vorschau).
// Ausführen: node tools/einzeldatei.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ziel = path.join(wurzel, 'einzeldatei');
fs.mkdirSync(ziel, { recursive: true });

const varianten = [
  ['variante-a-wizard', 'Dokucheckliste_Variante_A.html'],
  ['variante-b-formular', 'Dokucheckliste_Variante_B.html'],
  ['variante-ohne-blau', 'Dokucheckliste_PDok.html'],
  ['variante-ohne-blau-vorschau', 'Dokucheckliste_PDok_Variante2.html'],
];
for (const [ordner, datei] of varianten) {
  let html = fs.readFileSync(path.join(wurzel, ordner, 'index.html'), 'utf8');
  const vorher = (html.match(/<link rel="stylesheet"|<script src=/g) || []).length;
  let ersetzt = 0;
  html = html.replace(/<link rel="stylesheet" href="\.\.\/([^"]+)">/g,
    (_, f) => (ersetzt++, `<style>\n/* ${f} */\n${fs.readFileSync(path.join(wurzel, f), 'utf8')}</style>`));
  html = html.replace(/<script src="\.\.\/([^"]+)"><\/script>/g,
    (_, f) => (ersetzt++, `<script>\n/* ${f} */\n${fs.readFileSync(path.join(wurzel, f), 'utf8').replace(/<\/script/gi, '<\\/script')}</script>`));
  if (ersetzt !== vorher) throw new Error('Externe Referenz übrig in ' + datei);
  fs.writeFileSync(path.join(ziel, datei), html);
  console.log('erstellt', path.join('einzeldatei', datei));
}
