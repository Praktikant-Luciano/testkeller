/*
 * Dokucheckliste PDok – Entscheidungslogik (ohne DOM)
 * Grundlage: docs/Dokucheckliste_pdok_v3_nutzer.docx
 * ---------------------------------------------------
 * Reine Funktionen, damit dieselbe Logik in allen Varianten und in automatisierten Tests (Node) läuft.
 *
 * Einbindung im Browser:  <script src="../js/logik.js"></script>  -> window.DokuLogik
 * Einbindung in Node:      const DokuLogik = require('./js/logik.js')
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DokuLogik = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Konfiguration ---------- */
  const KONFIG = {
    zielPfad: 'G:\\Pflege Direktion\\gemeinsame Daten\\IT Koordination Pflege\\7_Auswertungen ePDOK\\Beschwerden_Schadensfälle\\test cp',
    ticketSystemLink: 'https://processes-web.lksdom21.lks.local/servicewareportal/home',
    dateiname: 'Abschlussbericht.txt',
    maxZeilen: 5,
    systeme: ['MV5', 'MV6', 'NICE', 'U', 'Papier'],
    // Laut Vorlage v3_nutzer: nur "Pflegeanamnese" fest, Rest noch offen
    kategorien: ['Pflegeanamnese', '… tba', '… tba', '… tba', '… tba', '… tba', '… tba'],
  };

  /* ---------- Texte (wörtlich aus der Vorlage; "(y/n)" -> "(Ja/Nein)" laut Vorgabe) ---------- */
  const TEXT = {
    que_1: 'Anfrage berechtigt? (Ja/Nein)',
    que_1_abbruch: 'Auf Antwort des Anfragegebers warten bzw. Rücksprache halten mit DL/MM',
    que_2: 'Betrifft die Anfrage ganz oder teilweise das UKS Campus LKH und/oder Campus CDK? (Ja/Nein)',
    que_2_abbruch: 'Die Stabstelle Pflegeinformatik des UKS ist nicht zuständig.',
    que_3_ordner: 'Ordner für die Aushebung eindeutig benennen und unter folgendem Pfad anlegen:',
    que_3_ticket: 'Ticket als Störung anlegen mit kurzer Darstellung des Sachverhalts. Anschließend Ticket sich selbst zuweisen unter',
    que_4_anzahl: 'Um wie viele auszuhebende Fälle bzw. Zeiträume handelt es sich?',
    que_4_wie: 'Wie soll ausgehoben werden?',
    que_4_was: 'Was darf ausgehoben werden?',
    que_4_komplett: 'Komplette PDok des Umfangs',
    que_4_teile: 'Teile des Umfangs',
    que_5: 'Welcher Fallstatus liegt vor?',
    que_6: 'Welche Dokumentationssysteme sind betroffen?', // ANNAHME: Vorlage hat keinen Fragetext
    que_7: 'Wurden alle relevanten Dokumente entsprechend Fallstatus-Dokumentationssystem inkl. Handsuche in Hydmedia identifiziert? (Ja/Nein)',
    que_8: 'Sind alle Dokumente einer der folgenden Kategorien zugeordnet? (Ja/Nein)',
    que_9: 'Export über Livelink opentext an den Anfragegeber ausgeführt? (Ja/Nein)',
    que_10: 'Wurde das Ticket geschlossen? (Ja/Nein)',
    que_10_nein: 'Ticket schliessen!',
    trotzdem: 'Trotzdem fortfahren? (Ja/Nein)',
  };

  const SCHRITTE = [
    { id: 'que_1', titel: 'Anfrage zur Aushebung der PDok' },
    { id: 'que_2', titel: 'Zuständigkeit bestätigt' },
    { id: 'que_3', titel: 'Dokumentation Beginn' },
    { id: 'que_4', titel: 'Umfang' },
    { id: 'que_5', titel: 'Fallstatus und Behandlungspfad' },
    { id: 'que_6', titel: 'Dokumentationssysteme' },
    { id: 'que_7', titel: 'Pflegeprozessdokumentation' },
    { id: 'que_8', titel: 'Strukturierung und Kontrollliste' },
    { id: 'que_9', titel: 'Export' },
    { id: 'que_10', titel: 'Dokumentation Ende' },
  ];

  /** Anzeige-Name laut Vorgabe: que_x -> "Frage x" */
  const frageName = (id) => 'Frage ' + String(id).split('_')[1];

  const FALLSTATUS = { entlassen: 'entlassen', aktuell: 'aktuell', gemischt: 'gemischt' };

  /* ---------- Zustand ---------- */
  function leererZustand() {
    const systemeLeer = () => Object.fromEntries(KONFIG.systeme.map((s) => [s, false]));
    return {
      que_1: null,                 // 'y' | 'n'
      que_2: null,
      que_3: { ordnerErledigt: false, ticketErledigt: false },
      que_4: {
        anzahlFaelle: '', anzahlZeitraeume: '', // Teilschritt 1 (leer = 0)
        anzahlBestaetigt: false,
        zeitraeume: [], faelle: [],             // Teilschritt 2
        umfangBestaetigt: false,
        art: null, teileText: '',               // Teilschritt 3
        weiter: false,
      },
      que_5: { status: null, weiter: false },
      que_6: { entlassen: systemeLeer(), aktuell: systemeLeer(), weiter: false },
      que_7: null, que_7_trotzdem: null,
      que_8: null, que_8_trotzdem: null,
      que_9: null, que_9_trotzdem: null,
      que_10: null,
      meta: { erstellt: null, ordnerName: null },
    };
  }

  /* ---------- Hilfsfunktionen / Validierung ---------- */
  const leer = (s) => typeof s !== 'string' || s.trim() === '';

  /** 'dd.mm.yyyy' -> Date (lokal, 00:00) oder null, prüft echte Kalenderdaten. */
  function parseDatum(text) {
    if (typeof text !== 'string') return null;
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text.trim());
    if (!m) return null;
    const t = +m[1], mo = +m[2], j = +m[3];
    const d = new Date(j, mo - 1, t);
    if (d.getFullYear() !== j || d.getMonth() !== mo - 1 || d.getDate() !== t) return null;
    return d;
  }

  /** Teilschritt 1: Anzahl 0–5. Leere Eingabe = 0. Gibt Zahl oder null (ungültig) zurück. */
  function parseAnzahl(text) {
    if (text == null || String(text).trim() === '') return 0;
    const s = String(text).trim();
    if (!/^\d+$/.test(s)) return null;
    const n = +s;
    return n >= 0 && n <= KONFIG.maxZeilen ? n : null;
  }

  function pruefeAnzahl(q4) {
    const f = parseAnzahl(q4.anzahlFaelle), z = parseAnzahl(q4.anzahlZeitraeume), fehler = [];
    if (f === null) fehler.push(`Fälle: Zahl von 0 bis ${KONFIG.maxZeilen} eingeben`);
    if (z === null) fehler.push(`Zeiträume: Zahl von 0 bis ${KONFIG.maxZeilen} eingeben`);
    if (!fehler.length && f + z === 0) fehler.push('Mindestens 1 Fall oder 1 Zeitraum angeben');
    return { ok: !fehler.length, fehler, faelle: f || 0, zeitraeume: z || 0 };
  }

  /** Passt die Zeilen von Teilschritt 2 an die Anzahl aus Teilschritt 1 an (vorhandene Werte bleiben). */
  function zeilenAnpassen(q4) {
    const a = pruefeAnzahl(q4);
    if (!a.ok) return q4;
    q4.faelle = Array.from({ length: a.faelle }, (_, i) => q4.faelle[i] || '');
    q4.zeitraeume = Array.from({ length: a.zeitraeume }, (_, i) => q4.zeitraeume[i] || { von: '', bis: '' });
    return q4;
  }

  /** Prüft eine Zeitraumzeile: Fehlertext oder 'ok'. */
  function pruefeZeitraum(z) {
    if (leer(z.von) || leer(z.bis)) return 'Von und Bis ausfüllen';
    const von = parseDatum(z.von), bis = parseDatum(z.bis);
    if (!von || !bis) return 'Datum im Format TT.MM.JJJJ eingeben';
    if (von > bis) return '„Von“ liegt nach „Bis“';
    return 'ok';
  }

  /** Teilschritt 2: Alle angekündigten Zeilen müssen gültig ausgefüllt sein. */
  function pruefeUmfang(q4) {
    const fehler = [];
    const a = pruefeAnzahl(q4);
    if (!a.ok) return { ok: false, fehler: a.fehler };
    if (q4.zeitraeume.length !== a.zeitraeume || q4.faelle.length !== a.faelle) fehler.push('Anzahl geändert – bitte Teilschritt 1 erneut bestätigen');
    q4.zeitraeume.forEach((z, i) => {
      const r = pruefeZeitraum(z);
      if (r !== 'ok') fehler.push(`Zeitraum #${i + 1}: ${r}`);
    });
    const gesehen = new Set();
    q4.faelle.forEach((f, i) => {
      if (leer(f)) { fehler.push(`Fall #${i + 1}: Fallnummer eingeben`); return; }
      const n = f.trim();
      if (gesehen.has(n)) fehler.push(`Fall #${i + 1}: Fallnummer doppelt`);
      gesehen.add(n);
    });
    return { ok: fehler.length === 0, fehler };
  }

  function pruefeArt(q4) {
    if (q4.art === 'komplett') return { ok: true, fehler: [] };
    if (q4.art === 'teile') return leer(q4.teileText)
      ? { ok: false, fehler: ['Teile des Umfangs beschreiben'] }
      : { ok: true, fehler: [] };
    return { ok: false, fehler: ['Auswahl treffen'] };
  }

  /** Welche Spalten (tree) in que_6 aktiv sind – abhängig von que_5. */
  function aktiveSpalten(status) {
    if (status === 'entlassen') return ['entlassen'];  // tree_1
    if (status === 'aktuell') return ['aktuell'];      // tree_2
    if (status === 'gemischt') return ['entlassen', 'aktuell']; // tree_3 (= tree_1 und tree_2)
    return [];
  }

  function treeName(status) {
    return { entlassen: 'tree_1', aktuell: 'tree_2', gemischt: 'tree_3' }[status] || null;
  }

  function gewaehlteSysteme(q6, spalte) {
    return KONFIG.systeme.filter((s) => q6[spalte] && q6[spalte][s]);
  }

  /**
   * Prüft que_6. Vorlage v3_nutzer: "ausgegraut bis … eine Check-Box ausgewählt wurde" (1 Haken gesamt reicht).
   * Option strengGemischt: true -> bei tree_3 mind. 1 Haken JE Spalte.
   */
  function pruefeSysteme(q6, status, optionen = {}) {
    const spalten = aktiveSpalten(status);
    if (!spalten.length) return { ok: false, fehler: ['Zuerst Fallstatus wählen'] };
    const anzahl = spalten.map((sp) => gewaehlteSysteme(q6, sp).length);
    if (optionen.strengGemischt === true && spalten.length === 2) {
      const fehler = [];
      spalten.forEach((sp, i) => { if (!anzahl[i]) fehler.push(`Spalte „${sp}“: mindestens ein System wählen`); });
      return { ok: !fehler.length, fehler };
    }
    return anzahl.some((n) => n > 0) ? { ok: true, fehler: [] } : { ok: false, fehler: ['Mindestens ein System wählen'] };
  }

  /** Setzt Auswahl in nicht mehr aktiven Spalten zurück (verhindert "Geister-Auswahl" im Bericht). */
  function bereinigeSysteme(zustand) {
    const aktiv = aktiveSpalten(zustand.que_5.status);
    ['entlassen', 'aktuell'].forEach((sp) => {
      if (!aktiv.includes(sp)) KONFIG.systeme.forEach((s) => { zustand.que_6[sp][s] = false; });
    });
    return zustand;
  }

  /* ---------- Schrittprüfung ----------
   * Rückgabe: { status: 'erledigt'|'offen'|'abbruch'|'ende', meldung?, fehler?:[], rueckfrage?, teil? }
   */
  function janeinMitTrotzdem(antwort, trotzdem) {
    if (antwort === 'y') return { status: 'erledigt' };
    if (antwort === 'n') {
      if (trotzdem === 'y') return { status: 'erledigt', meldung: 'Trotzdem fortgefahren' };
      return { status: 'offen', rueckfrage: TEXT.trotzdem };
    }
    return { status: 'offen' };
  }

  function pruefeSchritt(id, z, optionen = {}) {
    switch (id) {
      case 'que_1':
        if (z.que_1 === 'y') return { status: 'erledigt' };
        if (z.que_1 === 'n') return { status: 'abbruch', meldung: TEXT.que_1_abbruch };
        return { status: 'offen' };
      case 'que_2':
        if (z.que_2 === 'y') return { status: 'erledigt' };
        if (z.que_2 === 'n') return { status: 'abbruch', meldung: TEXT.que_2_abbruch };
        return { status: 'offen' };
      case 'que_3':
        return z.que_3.ordnerErledigt && z.que_3.ticketErledigt ? { status: 'erledigt' } : { status: 'offen' };
      case 'que_4': {
        const q = z.que_4;
        const a = pruefeAnzahl(q);
        if (!a.ok || !q.anzahlBestaetigt) return { status: 'offen', fehler: a.fehler, teil: 'anzahl' };
        const u = pruefeUmfang(q);
        if (!u.ok || !q.umfangBestaetigt) return { status: 'offen', fehler: u.fehler, teil: 'umfang' };
        const r = pruefeArt(q);
        if (!r.ok || !q.weiter) return { status: 'offen', fehler: r.fehler, teil: 'art' };
        return { status: 'erledigt' };
      }
      case 'que_5':
        if (!FALLSTATUS[z.que_5.status]) return { status: 'offen', fehler: ['Fallstatus wählen'] };
        return z.que_5.weiter ? { status: 'erledigt' } : { status: 'offen', fehler: [] };
      case 'que_6': {
        const p = pruefeSysteme(z.que_6, z.que_5.status, optionen);
        if (!p.ok) return { status: 'offen', fehler: p.fehler };
        return z.que_6.weiter ? { status: 'erledigt' } : { status: 'offen', fehler: [] };
      }
      case 'que_7': return janeinMitTrotzdem(z.que_7, z.que_7_trotzdem);
      case 'que_8': return janeinMitTrotzdem(z.que_8, z.que_8_trotzdem);
      case 'que_9': return janeinMitTrotzdem(z.que_9, z.que_9_trotzdem);
      case 'que_10':
        if (z.que_10 === 'y') return { status: 'ende' };
        if (z.que_10 === 'n') return { status: 'offen', meldung: TEXT.que_10_nein };
        return { status: 'offen' };
      default: throw new Error('Unbekannter Schritt: ' + id);
    }
  }

  /**
   * Wertet den gesamten Pfad aus:
   * { aktuell: 'que_x'|null, schritte: [{id, status, ...}], abbruch: string|null, ende: bool }
   * Schritte nach dem ersten offenen/abgebrochenen Schritt werden NICHT geliefert (gesperrt).
   */
  function auswerten(z, optionen = {}) {
    const schritte = [];
    for (const s of SCHRITTE) {
      const r = Object.assign({ id: s.id, titel: s.titel }, pruefeSchritt(s.id, z, optionen));
      schritte.push(r);
      if (r.status === 'abbruch') return { aktuell: s.id, schritte, abbruch: r.meldung, ende: false };
      if (r.status === 'ende') return { aktuell: s.id, schritte, abbruch: null, ende: true };
      if (r.status === 'offen') return { aktuell: s.id, schritte, abbruch: null, ende: false };
    }
    return { aktuell: null, schritte, abbruch: null, ende: false }; // nicht erreichbar
  }

  /** Abschlussbericht.txt existiert ab "Erledigt" (Ordner angelegt) in Frage 3. */
  function berichtAngelegt(z) {
    return z.que_1 === 'y' && z.que_2 === 'y' && z.que_3.ordnerErledigt;
  }

  /* ---------- Abschlussbericht ---------- */
  const zwei = (n) => String(n).padStart(2, '0');
  function formatZeit(d) {
    return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()} ${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
  }
  const jn = (v) => (v === 'y' ? 'Ja' : v === 'n' ? 'Nein' : '–');

  /**
   * Baut den Inhalt von Abschlussbericht.txt aus dem Zustand.
   * Enthält nur erreichte Schritte. Zeilenende CRLF (ANNAHME: Windows-Umgebung).
   */
  function berichtText(z, jetzt = new Date(), optionen = {}) {
    const e = auswerten(z, optionen);
    const erreicht = new Set(e.schritte.map((s) => s.id));
    const L = [];
    L.push('ABSCHLUSSBERICHT – Aushebung Pflegeprozessdokumentation (PDok)');
    L.push('='.repeat(62));
    if (z.meta.erstellt) L.push('Angelegt:   ' + formatZeit(new Date(z.meta.erstellt)));
    L.push('Stand:      ' + formatZeit(jetzt));
    L.push('Status:     ' + (e.ende ? 'ABGESCHLOSSEN' : e.abbruch ? 'ABGEBROCHEN – ' + e.abbruch : 'IN BEARBEITUNG (' + frageName(e.aktuell) + ')'));
    L.push('Ablage:     ' + KONFIG.zielPfad + '\\' + (z.meta.ordnerName || '<Ordnername nicht erfasst>'));
    L.push('');

    const zeile = (nr, titel, text) => L.push(`[Frage ${nr}] ${titel}: ${text}`);

    if (erreicht.has('que_1') && z.que_1) zeile(1, 'Anfrage berechtigt', jn(z.que_1));
    if (erreicht.has('que_2') && z.que_2) zeile(2, 'Zuständigkeit UKS Campus LKH / CDK', jn(z.que_2));
    if (erreicht.has('que_3')) {
      if (z.que_3.ordnerErledigt) zeile(3, 'Ordner angelegt', 'Ja');
      if (z.que_3.ticketErledigt) L.push('    Ticket als Störung angelegt und selbst zugewiesen: Ja');
    }
    if (erreicht.has('que_4') && z.que_4.umfangBestaetigt) {
      const q = z.que_4;
      zeile(4, 'Umfang', `${q.faelle.length} Fall/Fälle, ${q.zeitraeume.length} Zeitraum/Zeiträume`);
      q.zeitraeume.forEach((r, i) => { if (pruefeZeitraum(r) === 'ok') L.push(`    Zeitraum #${i + 1}: ${r.von.trim()} – ${r.bis.trim()}`); });
      q.faelle.forEach((f, i) => { if (!leer(f)) L.push(`    Fall #${i + 1}: ${f.trim()}`); });
      if (q.weiter && pruefeArt(q).ok) {
        L.push('    Aushebung: ' + (q.art === 'komplett' ? TEXT.que_4_komplett : TEXT.que_4_teile + ' – ' + q.teileText.trim()));
      }
    }
    if (erreicht.has('que_5') && z.que_5.weiter && z.que_5.status) zeile(5, 'Fallstatus', z.que_5.status);
    if (erreicht.has('que_6') && z.que_6.weiter) {
      zeile(6, 'Dokumentationssysteme (' + treeName(z.que_5.status) + ')', '');
      aktiveSpalten(z.que_5.status).forEach((sp) => {
        const g = gewaehlteSysteme(z.que_6, sp);
        L.push(`    ${sp}: ${g.length ? g.join(', ') : '–'}`);
      });
    }
    [['que_7', 7, 'Relevante Dokumente identifiziert (inkl. Hydmedia)'],
     ['que_8', 8, 'Dokumente Kategorien zugeordnet'],
     ['que_9', 9, 'Export über Livelink opentext ausgeführt']].forEach(([id, nr, titel]) => {
      if (!erreicht.has(id) || !z[id]) return;
      if (z[id] === 'y') zeile(nr, titel, 'Ja');
      else if (z[id + '_trotzdem'] === 'y') zeile(nr, titel, 'Nein – TROTZDEM FORTGEFAHREN');
    });
    if (erreicht.has('que_10') && z.que_10 === 'y') zeile(10, 'Ticket geschlossen', 'Ja');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------- Zustandsänderungen (gemeinsam für alle UIs) ---------- */
  /**
   * Setzt eine Ja/Nein-Antwort und wendet die Folgelogik an
   * (z. B. "if n in que_x bleiben" => Antwort zurücksetzen). Rückgabe: { hinweis? }
   */
  function antworte(z, feld, wert) {
    z[feld] = wert;
    if (/^que_[789]$/.test(feld)) z[feld + '_trotzdem'] = null;
    if (feld === 'que_10' && wert === 'n') return { hinweis: TEXT.que_10_nein };
    const m = /^(que_[789])_trotzdem$/.exec(feld);
    if (m && wert === 'n') { z[m[1]] = null; z[feld] = null; return { hinweis: 'Bitte Schritt abschließen, dann erneut beantworten.' }; }
    return {};
  }

  return {
    KONFIG, TEXT, SCHRITTE, frageName,
    leererZustand, parseDatum, parseAnzahl, pruefeAnzahl, zeilenAnpassen, pruefeZeitraum, pruefeUmfang, pruefeArt, pruefeSysteme,
    aktiveSpalten, treeName, gewaehlteSysteme, bereinigeSysteme,
    pruefeSchritt, auswerten, berichtAngelegt, berichtText, antworte, formatZeit,
  };
});
