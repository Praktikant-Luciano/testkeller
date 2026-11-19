// Ausführen: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logik.js');

/** Hilfsfunktion: Zustand bis einschließlich Schritt n "glücklich" ausfüllen. */
function bis(n) {
  const z = L.leererZustand();
  z.meta.erstellt = new Date(2026, 10, 19, 9, 0).toISOString();
  if (n >= 1) z.que_1 = 'y';
  if (n >= 2) z.que_2 = 'y';
  if (n >= 3) Object.assign(z.que_3, { ordnerPfad: 'X:\\PDok\\2026-001', ordnerErledigt: true, ticketErledigt: true, linkDokumentieren: 'n', weiter: true });
  if (n >= 4) Object.assign(z.que_4, { zeitraeume: [{ von: '01.01.2026', bis: '31.01.2026' }], umfangBestaetigt: true, art: 'komplett', weiter: true });
  if (n >= 5) Object.assign(z.que_5, { status: 'entlassen', weiter: true });
  if (n >= 6) { z.que_6.entlassen.MV5 = true; z.que_6.weiter = true; }
  if (n >= 7) z.que_7 = 'y';
  if (n >= 8) z.que_8 = 'y';
  if (n >= 9) z.que_9 = 'y';
  if (n >= 10) z.que_10 = 'y';
  return z;
}

test('Startzustand: que_1 ist aktiv, nichts danach sichtbar', () => {
  const e = L.auswerten(L.leererZustand());
  assert.equal(e.aktuell, 'que_1');
  assert.equal(e.schritte.length, 1);
});

test('Glücklicher Pfad endet mit Ende bei que_10', () => {
  const e = L.auswerten(bis(10));
  assert.equal(e.ende, true);
  assert.equal(e.schritte.length, 10);
});

for (let n = 0; n < 10; n++) {
  test(`Bis que_${n} ausgefüllt => aktiv ist que_${n + 1}`, () => {
    assert.equal(L.auswerten(bis(n)).aktuell, `que_${n + 1}`);
  });
}

test('que_1 n => Abbruch mit Text aus Vorlage v2_neu', () => {
  const z = L.leererZustand(); z.que_1 = 'n';
  const e = L.auswerten(z);
  assert.equal(e.abbruch, 'Auf Antwort des Anfragegebers warten bzw. Rücksprache halten mit DL/MM');
});

test('que_2 n => sofortiger Abbruch (v2_neu, keine Rückfrage mehr)', () => {
  const z = bis(1); z.que_2 = 'n';
  assert.equal(L.auswerten(z).abbruch, 'Die Stabstelle Pflegeinformatik des UKS ist nicht zuständig.');
  assert.equal(L.berichtAngelegt(z), false);
});

test('que_3: Pfad nur Leerzeichen zählt nicht', () => {
  const z = bis(3); z.que_3.ordnerPfad = '   ';
  assert.equal(L.auswerten(z).aktuell, 'que_3');
  assert.equal(L.berichtAngelegt(z), false);
});

test('que_3: Link y verlangt gespeicherten, nicht-leeren Link', () => {
  const z = bis(3); z.que_3.linkDokumentieren = 'y';
  assert.equal(L.auswerten(z).aktuell, 'que_3');
  z.que_3.ticketLink = 'https://t/1'; z.que_3.linkGespeichert = true;
  assert.equal(L.auswerten(z).aktuell, 'que_4');
});

test('Bericht existiert erst nach Ordner "Erledigt" (que_3)', () => {
  assert.equal(L.berichtAngelegt(bis(2)), false);
  const z = bis(2); z.que_3.ordnerPfad = 'X:\\a'; z.que_3.ordnerErledigt = true;
  assert.equal(L.berichtAngelegt(z), true);
});

test('Datum: echte Kalenderdaten, Format TT.MM.JJJJ', () => {
  assert.ok(L.parseDatum('29.02.2024'));
  assert.equal(L.parseDatum('29.02.2025'), null);
  assert.equal(L.parseDatum('31.04.2026'), null);
  assert.equal(L.parseDatum('2026-01-01'), null);
  assert.equal(L.parseDatum('1.1.2026'), null);
});

test('Zeitraum: Von nach Bis ist Fehler, halbe Zeile ist Fehler, leere Zeile wird ignoriert', () => {
  assert.match(L.pruefeZeitraum({ von: '02.01.2026', bis: '01.01.2026' }), /nach/);
  assert.match(L.pruefeZeitraum({ von: '01.01.2026', bis: '' }), /ausfüllen/);
  assert.equal(L.pruefeZeitraum({ von: '', bis: '' }), null);
  assert.equal(L.pruefeZeitraum({ von: '01.01.2026', bis: '01.01.2026' }), 'ok');
});

test('Umfang: nur Fallnummer reicht, gemischt reicht, nichts reicht nicht', () => {
  const q = L.leererZustand().que_4;
  assert.equal(L.pruefeUmfang(q).ok, false);
  q.faelle = ['12345']; assert.equal(L.pruefeUmfang(q).ok, true);
  q.zeitraeume = [{ von: '01.01.2026', bis: '02.01.2026' }]; assert.equal(L.pruefeUmfang(q).ok, true);
});

test('Umfang: doppelte Fallnummer und >5 Zeilen werden abgelehnt', () => {
  const q = L.leererZustand().que_4;
  q.faelle = ['1', ' 1 ']; assert.equal(L.pruefeUmfang(q).ok, false);
  q.faelle = ['1', '2', '3', '4', '5', '6']; assert.equal(L.pruefeUmfang(q).ok, false);
});

test('Umfang: ungültige Zeile blockiert, auch wenn eine andere gültig ist', () => {
  const q = L.leererZustand().que_4;
  q.faelle = ['1']; q.zeitraeume = [{ von: '01.01.2026', bis: '' }];
  assert.equal(L.pruefeUmfang(q).ok, false);
});

test('que_4 Art: Teile verlangt Freitext', () => {
  const z = bis(4); z.que_4.art = 'teile';
  assert.equal(L.auswerten(z).aktuell, 'que_4');
  z.que_4.teileText = 'nur Pflegeanamnese';
  assert.equal(L.auswerten(z).aktuell, 'que_5');
});

test('que_5 -> que_6 Baum-Zuordnung', () => {
  assert.deepEqual(L.aktiveSpalten('entlassen'), ['entlassen']);
  assert.deepEqual(L.aktiveSpalten('aktuell'), ['aktuell']);
  assert.deepEqual(L.aktiveSpalten('gemischt'), ['entlassen', 'aktuell']);
  assert.equal(L.treeName('gemischt'), 'tree_3');
});

test('que_6: Auswahl in falscher Spalte zählt nicht', () => {
  const z = bis(5); z.que_6.aktuell.MV5 = true; z.que_6.weiter = true;
  assert.equal(L.auswerten(z).aktuell, 'que_6');
});

test('que_6 gemischt (tree_3): mind. 1 System JE Spalte nötig', () => {
  const z = bis(5); z.que_5.status = 'gemischt'; z.que_6.entlassen.NICE = true; z.que_6.weiter = true;
  assert.equal(L.auswerten(z).aktuell, 'que_6');
  assert.equal(L.auswerten(z, { strengGemischt: false }).aktuell, 'que_7'); // alte Regel abschaltbar
  z.que_6.aktuell.U = true;
  assert.equal(L.auswerten(z).aktuell, 'que_7');
});

test('Fallstatus wechseln bereinigt Auswahl der inaktiven Spalte', () => {
  const z = bis(5); z.que_5.status = 'gemischt'; z.que_6.aktuell.U = true; z.que_6.entlassen.MV5 = true;
  z.que_5.status = 'entlassen'; L.bereinigeSysteme(z);
  assert.equal(z.que_6.aktuell.U, false);
  assert.equal(z.que_6.entlassen.MV5, true);
});

for (const q of ['que_7', 'que_8']) {
  test(`${q}: n -> Rückfrage; trotzdem y -> weiter; trotzdem n -> bleiben (Antwort zurückgesetzt)`, () => {
    const n = +q.split('_')[1];
    const z = bis(n - 1);
    L.antworte(z, q, 'n');
    assert.equal(L.pruefeSchritt(q, z).rueckfrage, L.TEXT.trotzdem);
    L.antworte(z, q + '_trotzdem', 'n');
    assert.equal(z[q], null);
    assert.equal(L.auswerten(z).aktuell, q);
    L.antworte(z, q, 'n'); L.antworte(z, q + '_trotzdem', 'y');
    assert.equal(L.auswerten(z).aktuell, `que_${n + 1}`);
  });
}

test('que_9 n => kein Trotzdem, Hinweis, bleibt in que_9', () => {
  const z = bis(8);
  const r = L.antworte(z, 'que_9', 'n');
  assert.match(r.hinweis, /Export zuerst ausführen/);
  assert.equal(L.pruefeSchritt('que_9', z).rueckfrage, undefined);
  assert.equal(L.auswerten(z).aktuell, 'que_9');
  z.que_9_trotzdem = 'y'; // darf keine Wirkung haben
  assert.equal(L.auswerten(z).aktuell, 'que_9');
});

test('que_10 n => Hinweis "Ticket schliessen!" und bleibt offen', () => {
  const z = bis(9);
  const r = L.antworte(z, 'que_10', 'n');
  assert.equal(r.hinweis, 'Ticket schliessen!');
  assert.equal(L.auswerten(z).ende, false);
  assert.equal(L.auswerten(z).aktuell, 'que_10');
});

test('Frühere Antwort ändern sperrt alle späteren Schritte', () => {
  const z = bis(10); z.que_1 = 'n';
  const e = L.auswerten(z);
  assert.ok(e.abbruch);
  assert.equal(e.schritte.length, 1);
});

test('Bericht: vollständiger Pfad enthält alle Abschnitte, CRLF', () => {
  const z = bis(10); z.que_4.faelle = ['4711'];
  const t = L.berichtText(z, new Date(2026, 10, 19, 10, 30));
  assert.match(t, /Status: +ABGESCHLOSSEN/);
  assert.match(t, /Stand: +19\.11\.2026 10:30/);
  assert.match(t, /Zeitraum #1: 01\.01\.2026 – 31\.01\.2026/);
  assert.match(t, /Fall #1: 4711/);
  assert.match(t, /entlassen: MV5/);
  assert.match(t, /Link zum Ticket nicht in Abschlussbericht.txt enthalten/);
  assert.match(t, /\[10\] Ticket geschlossen: Ja/);
  assert.ok(t.includes('\r\n'));
  assert.ok(!/\r?\n/.test(t.replace(/\r\n/g, '')));
});

test('Bericht: "Trotzdem fortgefahren" wird dokumentiert', () => {
  const z = bis(7); z.que_8 = 'n'; z.que_8_trotzdem = 'y';
  assert.match(L.berichtText(z), /\[8\] .*Nein – TROTZDEM FORTGEFAHREN/);
});

test('Bericht: Auswahl aus inaktiver Spalte erscheint nicht', () => {
  const z = bis(6); z.que_6.aktuell.Papier = true; // Geister-Auswahl ohne Bereinigung
  const t = L.berichtText(z);
  assert.ok(!/aktuell:/.test(t));
});

test('Bericht: Ticket-Link wird übernommen', () => {
  const z = bis(3); Object.assign(z.que_3, { linkDokumentieren: 'y', ticketLink: ' https://t/42 ', linkGespeichert: true });
  assert.match(L.berichtText(z), /Ticket-Link: https:\/\/t\/42\r\n/);
});

test('Kategorien que_8: Pflegeprozess + "Sonstige", keine Platzhalter', () => {
  assert.ok(L.KONFIG.kategorien.includes('Pflegeanamnese'));
  assert.equal(L.KONFIG.kategorien.at(-1), 'Sonstige');
  assert.ok(!L.KONFIG.kategorien.some((k) => k.includes('tba')));
});
