// Browser-Ende-zu-Ende-Test beider Varianten (Playwright + Chromium).
// Ausführen: node tests/e2e.mjs   (benötigt: npm i -D playwright, oder vorinstalliertes Playwright)
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = process.env.SCREENSHOTS || null;

// Simuliert showDirectoryPicker mit einem In-Memory-Ordner
const fsMock = () => {
  window.__dateien = {};
  window.showDirectoryPicker = async () => ({
    name: 'PDok-Testordner',
    async getFileHandle(name, o) {
      if (!(name in window.__dateien) && !(o && o.create)) throw new DOMException('x', 'NotFoundError');
      return { async createWritable() { let buf = ''; return { async write(t) { buf += t; }, async close() { window.__dateien[name] = buf; } }; } };
    },
  });
};
const ohneFs = () => { delete window.showDirectoryPicker; };

async function ja(page, gruppe) { await page.locator(`[data-key="${gruppe}_y"]`).click(); }
async function nein(page, gruppe) { await page.locator(`[data-key="${gruppe}_n"]`).click(); }

async function durchlauf(page, { mitTrotzdem = false } = {}) {
  await ja(page, 'que_1');
  await ja(page, 'que_2');
  assert.equal(await page.locator('[data-key="zielpfad"]').innerText(), 'G:\\Pflege Direktion\\gemeinsame Daten\\IT Koordination Pflege\\7_Auswertungen ePDOK\\Beschwerden_Schadensfälle\\test cp');
  await page.locator('[data-key="ordner_erledigt"]').click();
  await page.locator('[data-key="ticket_erledigt"]').click();
  // Frage 4 – Teilschritt 1
  const weiter1 = page.locator('[data-key="q4_anzahl_weiter"]');
  assert.equal(await weiter1.isDisabled(), true, 'beide leer => gesperrt');
  await page.fill('[data-key="anz_f"]', '0');
  assert.equal(await weiter1.isDisabled(), true, 'nur 0 => gesperrt');
  await page.fill('[data-key="anz_f"]', '1');
  await page.fill('[data-key="anz_z"]', '1');
  await weiter1.click();
  // Teilschritt 2
  assert.equal(await page.locator('[data-key="f1"]').count(), 0, 'genau 1 Fallzeile');
  await page.fill('[data-key="zv0"]', '01.01.2026');
  await page.fill('[data-key="zb0"]', '31.12.2025');
  assert.equal(await page.locator('[data-key="q4_fertig"]').isDisabled(), true, 'Von>Bis muss sperren');
  await page.fill('[data-key="zb0"]', '31.01.2026');
  assert.equal(await page.locator('[data-key="q4_fertig"]').isDisabled(), true, 'Fallzeile leer muss sperren');
  await page.fill('[data-key="f0"]', '4711');
  await page.locator('[data-key="q4_fertig"]').click();
  // Teilschritt 3
  await page.locator('[data-key="q4art_teile"]').check();
  assert.equal(await page.locator('[data-key="q4_weiter"]').isDisabled(), true);
  await page.fill('[data-key="q4teile"]', 'nur Pflegeanamnese');
  await page.locator('[data-key="q4_weiter"]').click();
  // Frage 5/6
  await page.locator('[data-key="q5_gemischt"]').check();
  await page.locator('[data-key="q5_weiter"]').click();
  assert.equal(await page.locator('[data-key="q6_weiter"]').isDisabled(), true);
  await page.locator('[data-key="q6_entlassen_MV5"]').check();
  assert.equal(await page.locator('[data-key="q6_weiter"]').isDisabled(), false, 'laut Vorlage reicht 1 Haken');
  await page.locator('[data-key="q6_aktuell_NICE"]').check();
  await page.locator('[data-key="q6_weiter"]').click();
  // Frage 7–9
  if (mitTrotzdem) {
    await nein(page, 'que_7'); await nein(page, 'que_7_trotzdem');
    assert.equal(await page.locator('[data-key="que_7_y"]').getAttribute('aria-pressed'), 'false', 'Nein/Nein muss in Frage 7 bleiben');
    await nein(page, 'que_7'); await ja(page, 'que_7_trotzdem');
  } else await ja(page, 'que_7');
  await ja(page, 'que_8');
  if (mitTrotzdem) { await nein(page, 'que_9'); await ja(page, 'que_9_trotzdem'); } else await ja(page, 'que_9');
  await nein(page, 'que_10');
  assert.ok(await page.getByText('Ticket schliessen!').isVisible());
  await ja(page, 'que_10');
  return page.locator('[data-bericht]').innerText();
}

const browser = await chromium.launch();
let fehler = 0;
for (const variante of ['variante-a-wizard', 'variante-b-formular', 'variante-ohne-blau', 'einzeldatei/Dokucheckliste_PDok.html', 'einzeldatei/Dokucheckliste_Variante_A.html', 'einzeldatei/Dokucheckliste_Variante_B.html']) {
  for (const modus of ['fs', 'download']) {
    const name = `${variante} / ${modus}`;
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const konsolenFehler = [];
    page.on('pageerror', (e) => konsolenFehler.push(e.message));
    await page.addInitScript(modus === 'fs' ? fsMock : ohneFs);
    await page.goto(pathToFileURL(path.join(wurzel, variante.endsWith('.html') ? variante : path.join(variante, 'index.html'))).href);
    try {
      const bericht = await durchlauf(page, { mitTrotzdem: modus === 'download' });
      assert.match(bericht, /Status: +ABGESCHLOSSEN/);
      assert.match(bericht, /Fall #1: 4711/);
      assert.match(bericht, /\[Frage 10\] Ticket geschlossen: Ja/);
      assert.match(bericht, /Teile des Umfangs – nur Pflegeanamnese/);
      assert.match(bericht, /entlassen: MV5/);
      assert.match(bericht, /aktuell: NICE/);
      if (modus === 'fs') {
        await page.waitForTimeout(600);
        const datei = await page.evaluate(() => window.__dateien['Abschlussbericht.txt']);
        assert.ok(datei && datei.includes('ABGESCHLOSSEN'), 'Datei im Ordner muss Endstand haben');
        assert.ok(datei.includes('test cp\\PDok-Testordner'), 'gewählter Ordnername im Bericht');
      } else {
        assert.match(bericht, /\[Frage 7\] .*TROTZDEM FORTGEFAHREN/);
        assert.match(bericht, /\[Frage 9\] .*TROTZDEM FORTGEFAHREN/);
        const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Bericht herunterladen' }).last().click()]);
        assert.equal(dl.suggestedFilename(), 'Abschlussbericht.txt');
        const inhalt = fs.readFileSync(await dl.path(), 'utf8');
        assert.ok(inhalt.startsWith('\uFEFF') && inhalt.includes('\r\n'));
      }
      assert.deepEqual(konsolenFehler, []);
      if (shotDir) await page.screenshot({ path: path.join(shotDir, `${path.basename(variante)}-${modus}-ende.png`), fullPage: true });
      console.log('ok  ', name);
    } catch (e) {
      fehler++;
      console.log('FAIL', name, '\n', e.message);
      if (shotDir) await page.screenshot({ path: path.join(shotDir, `${path.basename(variante)}-${modus}-FEHLER.png`), fullPage: true });
    }
    await context.close();
  }
}

// Abbruchpfade
{
  const page = await browser.newPage();
  await page.addInitScript(ohneFs);
  await page.goto(pathToFileURL(path.join(wurzel, 'variante-a-wizard', 'index.html')).href);
  await nein(page, 'que_1');
  const ok1 = await page.getByText('Auf Antwort des Anfragegebers warten').isVisible();
  await page.getByRole('button', { name: 'Antwort korrigieren' }).click();
  await ja(page, 'que_1'); await nein(page, 'que_2');
  const ok2 = await page.getByText(/des UKS ist nicht zuständig/).isVisible();
  console.log(ok1 && ok2 ? 'ok  ' : 'FAIL', 'Abbruchpfade que_1 / que_2');
  if (!(ok1 && ok2)) fehler++;
}

// Variante B: frühere Antwort ändern sperrt spätere Schritte
{
  const page = await browser.newPage();
  await page.addInitScript(ohneFs);
  await page.goto(pathToFileURL(path.join(wurzel, 'variante-b-formular', 'index.html')).href);
  await ja(page, 'que_1'); await ja(page, 'que_2');
  const vorher = await page.locator('section.dc-karte[id^="karte_"]').count();
  await nein(page, 'que_1');
  const nachher = await page.locator('section.dc-karte[id^="karte_"]').count();
  const ok = vorher === 3 && nachher === 1;
  console.log(ok ? 'ok  ' : 'FAIL', `Variante B sperrt nach Korrektur (vorher ${vorher}, nachher ${nachher})`);
  if (!ok) fehler++;
  // Fokus bleibt beim Tippen erhalten
  await ja(page, 'que_1');
  await page.locator('[data-key="ordner_erledigt"]').click();
  await page.locator('[data-key="ticket_erledigt"]').click();
  await page.locator('[data-key="anz_f"]').click();
  await page.keyboard.type('1');
  await page.locator('[data-key="q4_anzahl_weiter"]').click();
  await page.locator('[data-key="f0"]').click();
  await page.keyboard.type('AB-4711');
  const wert = await page.inputValue('[data-key="f0"]');
  console.log(wert === 'AB-4711' ? 'ok  ' : 'FAIL', 'Tippen ohne Fokusverlust');
  if (wert !== 'AB-4711') fehler++;
}

await browser.close();
process.exit(fehler ? 1 : 0);
