/*
 * Dokucheckliste PDok – Entscheidungslogik (ohne DOM)
 * ---------------------------------------------------
 * Reine Funktionen, damit dieselbe Logik in beiden Varianten (Wizard, Formular)
 * und in automatisierten Tests (Node) verwendet werden kann.
 *
 * Einbindung im Browser:  <script src="../js/logik.js"></script>  -> window.DokuLogik
 * Einbindung in Node:      const DokuLogik = require('./js/logik.js')
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DokuLogik = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Konfiguration (Platzhalter aus der Vorlage: "tba") ---------- */
  const KONFIG = {
    explorerLink: '#explorer-link-tba',           // ANNAHME: wird später ersetzt
    ticketSystemLink: 'https://ticket.example.invalid/neu', // Dummy-Link laut Vorlage
    dateiname: 'Abschlussbericht.txt',
    maxZeilen: 5,
    systeme: ['MV5', 'MV6', 'NICE', 'U', 'Papier'],
    // Generische Kategorien entlang des Pflegeprozesses (Anamnese → Diagnose → Planung → Durchführung → Evaluation)
    kategorien: [
      'Pflegeanamnese',
      'Pflegeassessments / Risikoeinschätzungen',
      'Pflegediagnosen / Pflegeprobleme und Ressourcen',
      'Pflegeplanung (Ziele und Maßnahmen)',
      'Durchführungsnachweis (Pflegeinterventionen)',
      'Pflegebericht',
      'Pflegeevaluation',
      'Sonstige',
    ],
  };

  /* ---------- Texte (wörtlich aus der Vorlage) ---------- */
  const TEXT = {
    que_1: 'Anfrage legitim? (y/n)',
    que_1_abbruch: 'Auf Antwort des Anfragegebers warten bzw. Rücksprache halten mit DL/MM',
    que_2: 'Betrifft die Anfrage ganz oder teilweise das UKS Campus LKH und/oder Campus CDK? (y/n)',
    que_2_abbruch: 'Die Stabstelle Pflegeinformatik des UKS ist nicht zuständig.',
    que_3_ordner: 'Ordner anlegen unter (explorer link tba) und eindeutig benennen und Pfad zum Ordner hier eingeben:',
    que_3_ticket: 'Ticket anlegen mit kurzer Darstellung des Sachverhalts. Anschließend Ticket an Bearbeitenden zuweisen.',
    sub_que_3: 'Link zum Ticket hier dokumentieren? (y/n)',
    sub_que_3_ja: 'Link zum Ticket in Abschlussbericht.txt gespeichert.',
    sub_que_3_nein: 'Link zum Ticket nicht in Abschlussbericht.txt enthalten',
    que_4_wie: 'Wie soll ausgehoben werden?',
    que_4_was: 'Was darf ausgehoben werden?',
    que_4_komplett: 'Komplette PDok des Umfangs',
    que_4_teile: 'Teile des Umfangs',
    que_5: 'Welcher Fallstatus liegt vor?',
    que_6: 'Welche Dokumentationssysteme sind betroffen?', // ANNAHME: Vorlage hat keinen Fragetext
    que_7: 'Wurden alle relevanten Dokumente entsprechend Fallstatus-Dokumentationssystem identifiziert? (y/n)',
    que_8: 'Sind alle Dokumente einer der folgenden Kategorien zugeordnet? (y/n)',
    que_9: 'Export über Livelink opentext an den Anfragegeber ausgeführt? (y/n)',
    que_9_nein: 'Export zuerst ausführen. Ohne Export kann das Ticket nicht geschlossen werden.',
    que_10: 'Wurde das Ticket geschlossen? (y/n)',
    que_10_nein: 'Ticket schliessen!',
    trotzdem: 'Trotzdem fortfahren? (y/n)',
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

  const FALLSTATUS = { entlassen: 'entlassen', aktuell: 'aktuell', gemischt: 'gemischt' };

  /* ---------- Zustand ---------- */
  function leererZustand() {
    const systemeLeer = () => Object.fromEntries(KONFIG.systeme.map((s) => [s, false]));
    return {
      que_1: null,                 // 'y' | 'n'
      que_2: null,
      que_3: {
        ordnerPfad: '', ordnerErledigt: false,
        ticketErledigt: false,
        linkDokumentieren: null,   // sub_que_3: 'y' | 'n'
        ticketLink: '', linkGespeichert: false,
        weiter: false,
      },
      que_4: {
        zeitraeume: [{ von: '', bis: '' }],
        faelle: [''],
        umfangBestaetigt: false,   // "Fertig und weiter"
        art: null,                 // 'komplett' | 'teile'
        teileText: '',
        weiter: false,
      },
      que_5: { status: null, weiter: false },
      que_6: { entlassen: systemeLeer(), aktuell: systemeLeer(), weiter: false },
      que_7: null, que_7_trotzdem: null,
      que_8: null, que_8_trotzdem: null,
      que_9: null,
      que_10: null,
      meta: { erstellt: null },
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

  /** Prüft eine Zeitraumzeile. Leere Zeile = ignoriert (null), sonst Fehlertext oder 'ok'. */
  function pruefeZeitraum(z) {
    const vonLeer = leer(z.von), bisLeer = leer(z.bis);
    if (vonLeer && bisLeer) return null;
    if (vonLeer || bisLeer) return 'Von und Bis ausfüllen';
    const von = parseDatum(z.von), bis = parseDatum(z.bis);
    if (!von || !bis) return 'Datum im Format TT.MM.JJJJ eingeben';
    if (von > bis) return '„Von“ liegt nach „Bis“';
    return 'ok';
  }

  /** Prüft que_4 Teil 1 (Umfang). */
  function pruefeUmfang(q4) {
    const fehler = [];
    let gueltigeZeitraeume = 0, gueltigeFaelle = 0;
    if (q4.zeitraeume.length > KONFIG.maxZeilen) fehler.push(`Maximal ${KONFIG.maxZeilen} Zeiträume`);
    if (q4.faelle.length > KONFIG.maxZeilen) fehler.push(`Maximal ${KONFIG.maxZeilen} Fälle`);
    q4.zeitraeume.forEach((z, i) => {
      const r = pruefeZeitraum(z);
      if (r === 'ok') gueltigeZeitraeume++;
      else if (r) fehler.push(`Zeitraum #${i + 1}: ${r}`);
    });
    const gesehen = new Set();
    q4.faelle.forEach((f, i) => {
      if (leer(f)) return;
      const n = f.trim();
      if (gesehen.has(n)) fehler.push(`Fall #${i + 1}: Fallnummer doppelt`);
      gesehen.add(n);
      gueltigeFaelle++;
    });
    if (gueltigeZeitraeume + gueltigeFaelle === 0) fehler.push('Mindestens einen Zeitraum oder eine Fallnummer angeben');
    return { ok: fehler.length === 0, fehler, gueltigeZeitraeume, gueltigeFaelle };
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
    if (status === 'gemischt') return ['entlassen', 'aktuell']; // tree_3
    return [];
  }

  function treeName(status) {
    return { entlassen: 'tree_1', aktuell: 'tree_2', gemischt: 'tree_3' }[status] || null;
  }

  function gewaehlteSysteme(q6, spalte) {
    return KONFIG.systeme.filter((s) => q6[spalte] && q6[spalte][s]);
  }

  /**
   * Prüft que_6. Vorlage: "ausgegraut bis … eine Check-Box ausgewählt wurde".
   * Entscheidung 19.11.2026: bei "gemischt" (tree_3) mind. eine Box JE Spalte (entlassen UND aktuell).
   * Mit optionen.strengGemischt === false gilt wieder die alte Regel (1 Box gesamt).
   */
  function pruefeSysteme(q6, status, optionen = {}) {
    const spalten = aktiveSpalten(status);
    if (!spalten.length) return { ok: false, fehler: ['Zuerst Fallstatus wählen'] };
    const anzahl = spalten.map((sp) => gewaehlteSysteme(q6, sp).length);
    if (optionen.strengGemischt !== false && spalten.length === 2) {
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
   * Rückgabe: { status: 'erledigt'|'offen'|'abbruch'|'ende', meldung?, fehler?:[] , rueckfrage? }
   */
  function janeinMitTrotzdem(antwort, trotzdem, frageText) {
    if (antwort === 'y') return { status: 'erledigt' };
    if (antwort === 'n') {
      if (trotzdem === 'y') return { status: 'erledigt', meldung: 'Trotzdem fortgefahren' };
      // trotzdem === 'n' -> "in que_x bleiben": UI setzt Antwort zurück (siehe antworte()).
      return { status: 'offen', rueckfrage: TEXT.trotzdem };
    }
    return { status: 'offen', frage: frageText };
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
      case 'que_3': {
        const q = z.que_3, fehler = [];
        if (leer(q.ordnerPfad) || !q.ordnerErledigt) fehler.push('Ordnerpfad eingeben und „Erledigt“ drücken');
        if (!q.ticketErledigt) fehler.push('Ticket anlegen und „Erledigt“ drücken');
        if (q.linkDokumentieren === null) fehler.push('Frage zum Ticket-Link beantworten');
        if (q.linkDokumentieren === 'y' && (leer(q.ticketLink) || !q.linkGespeichert)) fehler.push('Ticket-Link eingeben und speichern');
        if (fehler.length) return { status: 'offen', fehler };
        return q.weiter ? { status: 'erledigt' } : { status: 'offen', fehler: [] };
      }
      case 'que_4': {
        const u = pruefeUmfang(z.que_4);
        if (!u.ok || !z.que_4.umfangBestaetigt) return { status: 'offen', fehler: u.fehler, teil: 'umfang' };
        const a = pruefeArt(z.que_4);
        if (!a.ok || !z.que_4.weiter) return { status: 'offen', fehler: a.fehler, teil: 'art' };
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
      // Entscheidung 19.11.2026: kein "Trotzdem fortfahren" bei que_9 – ohne Export kein Ticketschluss.
      case 'que_9':
        if (z.que_9 === 'y') return { status: 'erledigt' };
        if (z.que_9 === 'n') return { status: 'offen', meldung: TEXT.que_9_nein };
        return { status: 'offen' };
      case 'que_10':
        if (z.que_10 === 'y') return { status: 'ende' };
        if (z.que_10 === 'n') return { status: 'offen', meldung: TEXT.que_10_nein };
        return { status: 'offen' };
      default: throw new Error('Unbekannter Schritt: ' + id);
    }
  }

  /**
   * Wertet den gesamten Pfad aus. Ergebnis:
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

  /** Ob Abschlussbericht.txt schon existieren darf (Vorlage: Anlage bei que_3 "Erledigt" für Ordner). */
  function berichtAngelegt(z) {
    return z.que_1 === 'y' && z.que_2 === 'y' && z.que_3.ordnerErledigt && !leer(z.que_3.ordnerPfad);
  }

  /* ---------- Abschlussbericht ---------- */
  const zwei = (n) => String(n).padStart(2, '0');
  function formatZeit(d) {
    return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()} ${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
  }
  const jn = (v) => (v === 'y' ? 'Ja' : v === 'n' ? 'Nein' : '–');

  /**
   * Baut den Inhalt von Abschlussbericht.txt aus dem Zustand.
   * Enthält nur Schritte, die erreicht wurden. Zeilenende CRLF (ANNAHME: Windows-Umgebung).
   */
  function berichtText(z, jetzt = new Date(), optionen = {}) {
    const e = auswerten(z, optionen);
    const erreicht = new Set(e.schritte.map((s) => s.id));
    const erledigt = (id) => e.schritte.some((s) => s.id === id && (s.status === 'erledigt' || s.status === 'ende'));
    const L = [];
    L.push('ABSCHLUSSBERICHT – Aushebung Pflegeprozessdokumentation (PDok)');
    L.push('='.repeat(62));
    if (z.meta.erstellt) L.push('Angelegt:          ' + formatZeit(new Date(z.meta.erstellt)));
    L.push('Stand:             ' + formatZeit(jetzt));
    L.push('Status:            ' + (e.ende ? 'ABGESCHLOSSEN' : e.abbruch ? 'ABGEBROCHEN – ' + e.abbruch : 'IN BEARBEITUNG (' + e.aktuell + ')'));
    L.push('Ordnerpfad:        ' + (leer(z.que_3.ordnerPfad) ? '–' : z.que_3.ordnerPfad.trim()));
    L.push('');

    const zeile = (nr, titel, text) => L.push(`[${nr}] ${titel}: ${text}`);

    if (erreicht.has('que_1') && z.que_1) zeile(1, 'Anfrage legitim', jn(z.que_1));
    if (erreicht.has('que_2') && z.que_2) zeile(2, 'Zuständigkeit UKS Campus LKH / CDK', jn(z.que_2));
    if (erreicht.has('que_3')) {
      const q = z.que_3;
      if (q.ordnerErledigt) zeile(3, 'Ordner angelegt', 'Ja');
      if (q.ticketErledigt) L.push('    Ticket angelegt und zugewiesen: Ja');
      if (q.linkDokumentieren === 'y' && q.linkGespeichert) L.push('    Ticket-Link: ' + q.ticketLink.trim());
      if (q.linkDokumentieren === 'n') L.push('    ' + TEXT.sub_que_3_nein);
    }
    if (erreicht.has('que_4') && z.que_4.umfangBestaetigt) {
      const q = z.que_4;
      zeile(4, 'Umfang', '');
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
    [['que_7', 7, 'Relevante Dokumente identifiziert'],
     ['que_8', 8, 'Dokumente Kategorien zugeordnet']].forEach(([id, nr, titel]) => {
      if (!erreicht.has(id) || !z[id]) return;
      let t = jn(z[id]);
      if (z[id] === 'n' && z[id + '_trotzdem'] === 'y') t += ' – TROTZDEM FORTGEFAHREN';
      if (erledigt(id) || z[id] === 'y') zeile(nr, titel, t);
    });
    if (erreicht.has('que_9') && z.que_9 === 'y') zeile(9, 'Export über Livelink opentext ausgeführt', 'Ja');
    if (erreicht.has('que_10') && z.que_10 === 'y') zeile(10, 'Ticket geschlossen', 'Ja');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------- Zustandsänderungen (gemeinsam für beide UIs) ---------- */
  /**
   * Setzt eine Ja/Nein-Antwort und wendet die Folgelogik an
   * (z. B. "if n in que_x bleiben" => Antwort zurücksetzen).
   * Gibt ein Hinweis-Objekt zurück, das die UI anzeigen kann.
   */
  function antworte(z, feld, wert) {
    z[feld] = wert;
    // Rücksetzen abhängiger Felder bei Änderung der Hauptantwort
    if (/^que_[78]$/.test(feld)) z[feld + '_trotzdem'] = null;
    if (feld === 'que_9' && wert === 'n') return { hinweis: TEXT.que_9_nein };
    if (feld === 'que_10' && wert === 'n') return { hinweis: TEXT.que_10_nein };
    // "Trotzdem fortfahren? n" => in que_x bleiben: Frage erneut stellen
    const m = /^(que_[78])_trotzdem$/.exec(feld);
    if (m && wert === 'n') { z[m[1]] = null; z[feld] = null; return { hinweis: 'Bitte Schritt abschließen, dann erneut beantworten.' }; }
    return {};
  }

  return {
    KONFIG, TEXT, SCHRITTE,
    leererZustand, parseDatum, pruefeZeitraum, pruefeUmfang, pruefeArt, pruefeSysteme,
    aktiveSpalten, treeName, gewaehlteSysteme, bereinigeSysteme,
    pruefeSchritt, auswerten, berichtAngelegt, berichtText, antworte, formatZeit,
  };
});
