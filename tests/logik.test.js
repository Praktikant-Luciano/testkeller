// Ausführen: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logik.js');

/** Zustand bis einschließlich Frage n "glücklich" ausfüllen. */
function bis(n) {
  const z = L.leererZustand();
  z.meta.erstellt = new Date(2026, 10, 19, 9, 0).toISOString();
  if (n >= 1) z.que_1 = 'y';
  if (n >= 2) z.que_2 = 'y';
  if (n >= 3) Object.assign(z.que_3, { ordnerErledigt: true, ticketErledigt: true });
  if (n >= 4) Object.assign(z.que_4, {
    anzahlZeitraeume: '1', anzahlFaelle: '', anzahlBestaetigt: true,
    zeitraeume: [{ von: '01.01.2026', bis: '31.01.2026' }], faelle: [], umfangBestaetigt: true,
    art: 'komplett', weiter: true,
  });
  if (n >= 5) Object.assign(z.que_5, { status: 'entlassen', weiter: true });
  if (n >= 6) { z.que_6.entlassen.MV5 = true; z.que_6.weiter = true; }
  if (n >= 7) z.que_7 = 'y';
  if (n >= 8) z.que_8 = 'y';
  if (n >= 9) z.que_9 = 'y';
  if (n >= 10) z.que_10 = 'y';
  return z;
}

test('Startzustand: Frage 1 aktiv, nichts danach sichtbar', () => {
  const e = L.auswerten(L.leererZustand());
  assert.equal(e.aktuell, 'que_1');
  assert.equal(e.schritte.length, 1);
});

test('Glücklicher Pfad endet bei Frage 10', () => {
  const e = L.auswerten(bis(10));
  assert.equal(e.ende, true);
  assert.equal(e.schritte.length, 10);
});

for (let n = 0; n < 10; n++) {
  test(`Bis Frage ${n} ausgefüllt => aktiv ist Frage ${n + 1}`, () => {
    assert.equal(L.auswerten(bis(n)).aktuell, `que_${n + 1}`);
  });
}

test('Anzeige: que_x -> "Frage x", (y/n) -> (Ja/Nein)', () => {
  assert.equal(L.frageName('que_10'), 'Frage 10');
  assert.ok(Object.values(L.TEXT).every((t) => !t.includes('(y/n)')));
  assert.equal(L.TEXT.que_1, 'Anfrage berechtigt? (Ja/Nein)');
});

test('Frage 1 Nein => Abbruch', () => {
  const z = L.leererZustand(); z.que_1 = 'n';
  assert.equal(L.auswerten(z).abbruch, 'Auf Antwort des Anfragegebers warten bzw. Rücksprache halten mit DL/MM');
});

test('Frage 2 Nein => Abbruch, kein Bericht', () => {
  const z = bis(1); z.que_2 = 'n';
  assert.equal(L.auswerten(z).abbruch, 'Die Stabstelle Pflegeinformatik des UKS ist nicht zuständig.');
  assert.equal(L.berichtAngelegt(z), false);
});

test('Frage 3: Bericht ab "Erledigt" Ordner; Ticket "Erledigt" => Frage 4', () => {
  const z = bis(2);
  assert.equal(L.berichtAngelegt(z), false);
  z.que_3.ordnerErledigt = true;
  assert.equal(L.berichtAngelegt(z), true);
  assert.equal(L.auswerten(z).aktuell, 'que_3');
  z.que_3.ticketErledigt = true;
  assert.equal(L.auswerten(z).aktuell, 'que_4');
});

test('Frage 4 Teilschritt 1: leer = 0, beide 0 sperrt, nur 0–5 erlaubt', () => {
  assert.equal(L.parseAnzahl(''), 0);
  assert.equal(L.parseAnzahl('3'), 3);
  assert.equal(L.parseAnzahl('6'), null);
  assert.equal(L.parseAnzahl('-1'), null);
  assert.equal(L.parseAnzahl('1.5'), null);
  const q = L.leererZustand().que_4;
  assert.equal(L.pruefeAnzahl(q).ok, false);
  q.anzahlFaelle = '0'; q.anzahlZeitraeume = '';
  assert.equal(L.pruefeAnzahl(q).ok, false);
  q.anzahlFaelle = '2';
  assert.equal(L.pruefeAnzahl(q).ok, true);
});

test('Frage 4: Zeilen werden an Anzahl angepasst, Werte bleiben erhalten', () => {
  const q = L.leererZustand().que_4;
  q.anzahlFaelle = '2'; L.zeilenAnpassen(q);
  assert.deepEqual(q.faelle, ['', '']);
  q.faelle[0] = '4711'; q.anzahlFaelle = '1'; q.anzahlZeitraeume = '1'; L.zeilenAnpassen(q);
  assert.deepEqual(q.faelle, ['4711']);
  assert.equal(q.zeitraeume.length, 1);
});

test('Frage 4 Teilschritt 2: alle angekündigten Zeilen müssen gültig sein', () => {
  const q = L.leererZustand().que_4;
  q.anzahlFaelle = '2'; q.anzahlZeitraeume = '1'; L.zeilenAnpassen(q);
  q.faelle = ['1', ''];
  q.zeitraeume = [{ von: '01.01.2026', bis: '31.01.2026' }];
  assert.equal(L.pruefeUmfang(q).ok, false, 'leere Fallzeile');
  q.faelle = ['1', ' 1 '];
  assert.equal(L.pruefeUmfang(q).ok, false, 'doppelte Fallnummer');
  q.faelle = ['1', '2'];
  assert.equal(L.pruefeUmfang(q).ok, true);
  q.anzahlFaelle = '3';
  assert.equal(L.pruefeUmfang(q).ok, false, 'Anzahl geändert ohne Bestätigung');
});

test('Datum: echte Kalenderdaten, Format TT.MM.JJJJ, Von ≤ Bis', () => {
  assert.ok(L.parseDatum('29.02.2024'));
  assert.equal(L.parseDatum('29.02.2025'), null);
  assert.equal(L.parseDatum('1.1.2026'), null);
  assert.match(L.pruefeZeitraum({ von: '02.01.2026', bis: '01.01.2026' }), /nach/);
  assert.equal(L.pruefeZeitraum({ von: '01.01.2026', bis: '01.01.2026' }), 'ok');
});

test('Frage 4 Teilschritt 3: Teile verlangt Freitext', () => {
  const z = bis(4); z.que_4.art = 'teile';
  assert.equal(L.auswerten(z).aktuell, 'que_4');
  z.que_4.teileText = 'nur Pflegeanamnese';
  assert.equal(L.auswerten(z).aktuell, 'que_5');
});

test('Frage 5 -> 6: Baum-Zuordnung', () => {
  assert.deepEqual(L.aktiveSpalten('entlassen'), ['entlassen']);
  assert.deepEqual(L.aktiveSpalten('aktuell'), ['aktuell']);
  assert.deepEqual(L.aktiveSpalten('gemischt'), ['entlassen', 'aktuell']);
});

test('Frage 6 gemischt: laut Vorlage reicht 1 Haken gesamt (strenge Regel nur per Option)', () => {
  const z = bis(5); z.que_5.status = 'gemischt'; z.que_6.entlassen.NICE = true; z.que_6.weiter = true;
  assert.equal(L.auswerten(z).aktuell, 'que_7');
  assert.equal(L.auswerten(z, { strengGemischt: true }).aktuell, 'que_6');
});

test('Frage 6: Auswahl in falscher Spalte zählt nicht; Wechsel bereinigt', () => {
  const z = bis(5); z.que_6.aktuell.MV5 = true; z.que_6.weiter = true;
  assert.equal(L.auswerten(z).aktuell, 'que_6');
  L.bereinigeSysteme(z);
  assert.equal(z.que_6.aktuell.MV5, false);
});

for (const q of ['que_7', 'que_8', 'que_9']) {
  test(`${L.frageName(q)}: Nein -> Trotzdem?; Nein -> bleiben; Ja -> weiter`, () => {
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

test('Frage 10 Nein => "Ticket schliessen!" und bleibt offen', () => {
  const z = bis(9);
  assert.equal(L.antworte(z, 'que_10', 'n').hinweis, 'Ticket schliessen!');
  assert.equal(L.auswerten(z).aktuell, 'que_10');
});

test('Frühere Antwort ändern sperrt alle späteren Schritte', () => {
  const z = bis(10); z.que_1 = 'n';
  assert.equal(L.auswerten(z).schritte.length, 1);
});

test('Kategorien Frage 8 laut Vorlage v3_nutzer', () => {
  assert.equal(L.KONFIG.kategorien[0], 'Pflegeanamnese');
  assert.equal(L.KONFIG.kategorien.length, 7);
});

test('Bericht: vollständiger Pfad, "Frage x", Ablagepfad, CRLF', () => {
  const z = bis(10); z.meta.ordnerName = '2026-001_Test';
  const t = L.berichtText(z, new Date(2026, 10, 19, 10, 30));
  assert.match(t, /Status: +ABGESCHLOSSEN/);
  assert.match(t, /Ablage: +G:\\Pflege Direktion\\.*\\test cp\\2026-001_Test/);
  assert.match(t, /\[Frage 4\] Umfang: 0 Fall\/Fälle, 1 Zeitraum/);
  assert.match(t, /Zeitraum #1: 01\.01\.2026 – 31\.01\.2026/);
  assert.match(t, /\[Frage 10\] Ticket geschlossen: Ja/);
  assert.ok(!/que_/.test(t));
  assert.ok(!/\r?\n/.test(t.replace(/\r\n/g, '')));
});

test('Bericht: ohne gewählten Ordner wird das kenntlich gemacht', () => {
  assert.match(L.berichtText(bis(3)), /<Ordnername nicht erfasst>/);
});

test('Bericht: "Trotzdem fortgefahren" wird dokumentiert (auch Frage 9)', () => {
  const z = bis(8); z.que_9 = 'n'; z.que_9_trotzdem = 'y';
  assert.match(L.berichtText(z), /\[Frage 9\] .*Nein – TROTZDEM FORTGEFAHREN/);
});
