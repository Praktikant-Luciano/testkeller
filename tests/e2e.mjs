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
  await nein(page, 'que_2'); await ja(page, 'sub_que_2');
  const erledigt = page.locator('[data-key="ordner_erledigt"]');
  assert.equal(await erledigt.isDisabled(), true, 'Erledigt muss ohne Pfad gesperrt sein');
  await page.fill('[data-key="pfad"]', 'X:\\PDok\\2026-001');
  await erledigt.click();
  await page.locator('[data-key="ticket_erledigt"]').click();
  await page.locator('[data-key="sq3_y"]').click();
  assert.equal(await page.locator('[data-key="link_speichern"]').isDisabled(), true);
  await page.fill('[data-key="ticketlink"]', 'https://ticket/4711');
  await page.locator('[data-key="link_speichern"]').click();
  await page.locator('[data-key="q3_weiter"]').click();
  // que_4
  await page.fill('[data-key="zv0"]', '01.01.2026');
  await page.fill('[data-key="zb0"]', '31.12.2025'); // falsch herum
  assert.equal(await page.locator('[data-key="q4_fertig"]').isDisabled(), true, 'Von>Bis muss sperren');
  await page.fill('[data-key="zb0"]', '31.01.2026');
  await page.locator('[data-key="plus_Fall"]').click();
  await page.fill('[data-key="f0"]', '4711');
  await page.locator('[data-key="q4_fertig"]').click();
  await page.locator('[data-key="q4art_teile"]').check();
  assert.equal(await page.locator('[data-key="q4_weiter"]').isDisabled(), true);
  await page.fill('[data-key="q4teile"]', 'nur Pflegeanamnese');
  await page.locator('[data-key="q4_weiter"]').click();
  // que_5/6
  await page.locator('[data-key="q5_gemischt"]').check();
  await page.locator('[data-key="q5_weiter"]').click();
  assert.equal(await page.locator('[data-key="q6_weiter"]').isDisabled(), true);
  await page.locator('[data-key="q6_entlassen_MV5"]').check();
  await page.locator('[data-key="q6_aktuell_NICE"]').check();
  await page.locator('[data-key="q6_weiter"]').click();
  // que_7..9
  if (mitTrotzdem) {
    await nein(page, 'que_7'); await nein(page, 'que_7_trotzdem');
    assert.equal(await page.locator('[data-key="que_7_y"]').getAttribute('aria-pressed'), 'false', 'n/n muss in que_7 bleiben');
    await nein(page, 'que_7'); await ja(page, 'que_7_trotzdem');
  } else await ja(page, 'que_7');
  await ja(page, 'que_8'); await ja(page, 'que_9');
  await nein(page, 'que_10');
  assert.ok(await page.getByText('Ticket schliessen!').isVisible());
  await ja(page, 'que_10');
  return page.locator('[data-bericht]').innerText();
}

const browser = await chromium.launch();
let fehler = 0;
for (const variante of ['variante-a-wizard', 'variante-b-formular']) {
  for (const modus of ['fs', 'download']) {
    const name = `${variante} / ${modus}`;
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const konsolenFehler = [];
    page.on('pageerror', (e) => konsolenFehler.push(e.message));
    await page.addInitScript(modus === 'fs' ? fsMock : ohneFs);
    await page.goto(pathToFileURL(path.join(wurzel, variante, 'index.html')).href);
    try {
      const bericht = await durchlauf(page, { mitTrotzdem: modus === 'download' });
      assert.match(bericht, /Status: +ABGESCHLOSSEN/);
      assert.match(bericht, /Ticket-Link: https:\/\/ticket\/4711/);
      assert.match(bericht, /Teile des Umfangs – nur Pflegeanamnese/);
      assert.match(bericht, /entlassen: MV5/);
      assert.match(bericht, /aktuell: NICE/);
      if (modus === 'fs') {
        await page.waitForTimeout(600);
        const datei = await page.evaluate(() => window.__dateien['Abschlussbericht.txt']);
        assert.ok(datei && datei.includes('ABGESCHLOSSEN'), 'Datei im Ordner muss Endstand haben');
      } else {
        assert.match(bericht, /\[7\] .*TROTZDEM FORTGEFAHREN/);
        const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Bericht herunterladen' }).last().click()]);
        assert.equal(dl.suggestedFilename(), 'Abschlussbericht.txt');
        const inhalt = fs.readFileSync(await dl.path(), 'utf8');
        assert.ok(inhalt.startsWith('\uFEFF') && inhalt.includes('\r\n'));
      }
      assert.deepEqual(konsolenFehler, []);
      if (shotDir) await page.screenshot({ path: path.join(shotDir, `${variante}-${modus}-ende.png`), fullPage: true });
      console.log('ok  ', name);
    } catch (e) {
      fehler++;
      console.log('FAIL', name, '\n', e.message);
      if (shotDir) await page.screenshot({ path: path.join(shotDir, `${variante}-${modus}-FEHLER.png`), fullPage: true });
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
  await ja(page, 'que_1'); await nein(page, 'que_2'); await nein(page, 'sub_que_2');
  const ok2 = await page.getByText(/fehlendes Mandat/).isVisible();
  console.log(ok1 && ok2 ? 'ok  ' : 'FAIL', 'Abbruchpfade que_1 / sub_que_2');
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
  await page.locator('[data-key="pfad"]').click();
  await page.keyboard.type('X:\\abc');
  const wert = await page.inputValue('[data-key="pfad"]');
  console.log(wert === 'X:\\abc' ? 'ok  ' : 'FAIL', 'Tippen ohne Fokusverlust');
  if (wert !== 'X:\\abc') fehler++;
}

await browser.close();
process.exit(fehler ? 1 : 0);
