/*
 * Gemeinsame UI-Bausteine für beide Varianten.
 * Jede Frage (que_1 … que_10) wird von genau einer Render-Funktion erzeugt.
 * Die Varianten unterscheiden sich nur darin, WELCHE Schritte sie zeigen und WIE (siehe wizard.js / formular.js).
 * Benötigt: logik.js, bericht-speicher.js
 */
(function (root) {
  'use strict';
  const L = root.DokuLogik, S = root.BerichtSpeicher, T = L.TEXT;

  /* ---------- DOM-Helfer ---------- */
  function h(tag, attrs, ...kinder) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const k of kinder.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : String(k));
    return el;
  }
  const meldung = (art, text) => h('div', { class: 'dc-meldung dc-meldung--' + art, role: art === 'warnung' ? 'alert' : 'status' }, text);
  const fehlerliste = (f) => (f && f.length ? h('ul', { class: 'dc-fehler', 'aria-live': 'polite' }, f.map((x) => h('li', null, x))) : null);

  /**
   * Controller: hält den Zustand, rendert neu (Fokus bleibt erhalten) und speichert den Bericht.
   * opts: { wurzel: Element, render: (ctx) => Node, optionen: {strengGemischt} }
   */
  function erstelleController(opts) {
    const ctx = {
      z: L.leererZustand(),
      optionen: opts.optionen || {},
      speicherInfo: S.ordnerZugriffMoeglich()
        ? 'Ordnerzugriff verfügbar: Bei „Erledigt“ (Frage 3) Zielordner wählen.'
        : 'Dieser Browser kann nicht direkt in Ordner schreiben. Bericht wird als Download bereitgestellt.',
      hinweise: {}, // flüchtige Meldungen je Schritt
      auswertung: null,
    };

    ctx.aktualisieren = function () {
      ctx.auswertung = L.auswerten(ctx.z, ctx.optionen);
      // Fokus + Cursor merken
      const a = document.activeElement, key = a && a.dataset ? a.dataset.key : null;
      const sel = key && 'selectionStart' in a ? [a.selectionStart, a.selectionEnd] : null;
      opts.wurzel.replaceChildren(opts.render(ctx));
      if (key) {
        const neu = opts.wurzel.querySelector(`[data-key="${CSS.escape(key)}"]`);
        if (neu) { neu.focus(); if (sel && neu.setSelectionRange) try { neu.setSelectionRange(sel[0], sel[1]); } catch (_) { /* z. B. radio */ } }
      }
      ctx.autoSpeichern();
      if (opts.nachRender) opts.nachRender(ctx);
    };

    let timer = null;
    ctx.autoSpeichern = function () {
      if (!S.ordner || !L.berichtAngelegt(ctx.z)) return;
      clearTimeout(timer);
      timer = setTimeout(ctx.jetztSpeichern, 400);
    };
    ctx.jetztSpeichern = async function () {
      const r = await S.schreiben(L.berichtText(ctx.z, new Date(), ctx.optionen));
      ctx.speicherInfo = r.ok
        ? `Gespeichert in Ordner „${S.ordner.name}“ um ${L.formatZeit(new Date()).slice(11)}.`
        : 'Speichern fehlgeschlagen. Bitte Bericht herunterladen.';
      const el = opts.wurzel.querySelector('[data-speicherinfo]');
      if (el) el.textContent = ctx.speicherInfo;
      return r;
    };
    ctx.herunterladen = () => S.herunterladen(L.berichtText(ctx.z, new Date(), ctx.optionen));
    ctx.neuStarten = () => { ctx.z = L.leererZustand(); ctx.hinweise = {}; S.zuruecksetzen(); ctx.aktualisieren(); };

    // Warnung beim Schließen, solange eine Checkliste läuft
    root.addEventListener('beforeunload', (e) => {
      if (ctx.z.que_1 !== null && !(ctx.auswertung && ctx.auswertung.ende)) { e.preventDefault(); e.returnValue = ''; }
    });
    return ctx;
  }

  /* ---------- Wiederverwendbare Controls ---------- */
  function jaNein(ctx, feld, label) {
    const wert = ctx.z[feld];
    const knopf = (w, text) => h('button', {
      type: 'button', class: 'dc-btn', 'aria-pressed': String(wert === w), 'data-key': feld + '_' + w,
      onclick: () => {
        Object.keys(ctx.hinweise).forEach((k) => { if (k.startsWith(feld)) ctx.hinweise[k] = null; });
        const r = L.antworte(ctx.z, feld, w); ctx.hinweise[feld] = r.hinweis || null; ctx.aktualisieren();
      },
    }, text);
    return h('div', null,
      h('p', { class: 'dc-frage', id: 'lbl_' + feld }, label),
      h('div', { class: 'dc-jn', role: 'group', 'aria-labelledby': 'lbl_' + feld }, knopf('y', 'Ja'), knopf('n', 'Nein')),
      ctx.hinweise[feld] ? meldung('warnung', ctx.hinweise[feld]) : null);
  }

  function textfeld(ctx, key, wert, setze, attrs = {}) {
    return h('input', Object.assign({
      class: 'dc-input', type: 'text', value: wert, 'data-key': key,
      oninput: (e) => { setze(e.target.value); ctx.aktualisieren(); },
    }, attrs));
  }

  function knopf(text, onclick, disabled, extra = {}) {
    return h('button', Object.assign({ type: 'button', class: 'dc-btn', disabled: !!disabled, onclick }, extra), text);
  }

  /* ---------- Schritte ---------- */
  const R = {};

  R.que_1 = (ctx) => jaNein(ctx, 'que_1', T.que_1);

  R.que_2 = (ctx) => jaNein(ctx, 'que_2', T.que_2);

  R.que_3 = (ctx) => {
    const q = ctx.z.que_3, teile = [];
    // Teil 1: Ordner unter festem Pfad anlegen
    teile.push(h('p', { class: 'dc-frage' }, T.que_3_ordner));
    teile.push(h('div', { class: 'dc-zeile' },
      h('code', { class: 'dc-pfad', 'data-key': 'zielpfad', 'aria-label': 'Zielpfad' }, L.KONFIG.zielPfad),
      h('button', { type: 'button', class: 'dc-btn dc-btn--sekundaer dc-btn--klein', 'data-key': 'pfad_kopieren', onclick: async (e) => {
        let ok = false;
        try { await navigator.clipboard.writeText(L.KONFIG.zielPfad); ok = true; } catch (_) { /* z. B. file:// ohne Berechtigung */ }
        e.target.textContent = ok ? 'Kopiert ✓' : 'Pfad markieren + Strg+C';
      } }, 'Pfad kopieren')));
    teile.push(h('div', { class: 'dc-zeile' },
      h('label', { for: 'ordnername' }, 'Ordnername *'),
      textfeld(ctx, 'ordnername', q.ordnerName, (v) => { q.ordnerName = v; }, { id: 'ordnername', required: true, readonly: q.ordnerErledigt, placeholder: 'z. B. 2026-11-19_Beschwerde_Muster', autocomplete: 'off' })));
    if (!q.ordnerErledigt) {
      if (S.ordnerZugriffMoeglich()) teile.push(h('p', null, 'Nach „Erledigt“ den soeben angelegten Ordner im Dialog auswählen. Dort wird Abschlussbericht.txt angelegt.'));
      teile.push(h('div', { class: 'dc-aktionen' }, knopf('Erledigt', async () => {
        if (S.ordnerZugriffMoeglich()) {
          const r = await S.ordnerWaehlen();
          if (r.ok) ctx.z.meta.ordnerName = r.name;
          else ctx.speicherInfo = r.grund === 'abgebrochen' || r.grund === 'abgelehnt'
            ? 'Kein Ordner gewählt. Bericht wird als Download bereitgestellt (oder „Ordner wählen“).'
            : 'Ordnerzugriff fehlgeschlagen. Bericht wird als Download bereitgestellt.';
        }
        q.ordnerErledigt = true;
        ctx.z.meta.erstellt = new Date().toISOString();
        ctx.aktualisieren();
        if (S.ordner) await ctx.jetztSpeichern();
      }, q.ordnerName.trim() === '', { 'data-key': 'ordner_erledigt' })));
      return h('div', null, teile);
    }
    teile.push(meldung('ok', S.ordner
      ? `${L.KONFIG.dateiname} im Ordner „${S.ordner.name}“ angelegt.`
      : `${L.KONFIG.dateiname} angelegt (im Browser; Download über „Bericht herunterladen“).`));

    // Teil 2: Ticket
    const t2 = h('div', { class: 'dc-teil' },
      h('p', { class: 'dc-frage' }, T.que_3_ticket + ' ',
        h('a', { href: L.KONFIG.ticketSystemLink, target: '_blank', rel: 'noopener' }, 'Serviceware-Portal'), '.'));
    t2.append(h('div', { class: 'dc-zeile' },
      h('label', { for: 'ticketnr' }, 'Ticketnummer *'),
      textfeld(ctx, 'ticketnr', q.ticketNummer, (v) => { q.ticketNummer = v; }, { id: 'ticketnr', required: true, readonly: q.ticketErledigt, placeholder: 'Ticketnummer', autocomplete: 'off' })));
    if (!q.ticketErledigt) t2.append(h('div', { class: 'dc-aktionen' }, knopf('Erledigt', () => { q.ticketErledigt = true; ctx.aktualisieren(); }, q.ticketNummer.trim() === '', { 'data-key': 'ticket_erledigt' })));
    teile.push(t2);
    return h('div', null, teile);
  };

  R.que_4 = (ctx) => {
    const q = ctx.z.que_4, anzahl = L.pruefeAnzahl(q);
    // Teilschritt 1: Anzahl
    const zahl = (key, feld, label) => h('td', null, h('input', {
      class: 'dc-input dc-input--zahl', type: 'text', inputmode: 'numeric', autocomplete: 'off',
      value: q[feld], 'data-key': key, 'aria-label': 'Anzahl ' + label, placeholder: '0',
      oninput: (e) => { q[feld] = e.target.value; q.anzahlBestaetigt = false; q.umfangBestaetigt = false; ctx.aktualisieren(); },
    }));
    const teil1 = h('div', null,
      h('h3', null, 'Teilschritt 1 · Anzahl'),
      h('p', { class: 'dc-frage' }, T.que_4_anzahl),
      h('table', { class: 'dc-tabelle' },
        h('thead', null, h('tr', null, h('th', null, ''), h('th', { scope: 'col' }, 'Fälle'), h('th', { scope: 'col' }, 'Zeiträume'))),
        h('tbody', null, h('tr', null, h('th', { scope: 'row' }, `Anzahl (0–${L.KONFIG.maxZeilen})`), zahl('anz_f', 'anzahlFaelle', 'Fälle'), zahl('anz_z', 'anzahlZeitraeume', 'Zeiträume')))),
      (q.anzahlFaelle !== '' || q.anzahlZeitraeume !== '') ? fehlerliste(anzahl.fehler) : null);
    if (!q.anzahlBestaetigt) {
      teil1.append(h('div', { class: 'dc-aktionen' }, knopf('Weiter', () => { L.zeilenAnpassen(q); q.anzahlBestaetigt = true; ctx.aktualisieren(); }, !anzahl.ok, { 'data-key': 'q4_anzahl_weiter' })));
      return teil1;
    }

    // Teilschritt 2: Zeilen laut Anzahl
    const umfang = L.pruefeUmfang(q);
    const teil2 = h('div', { class: 'dc-teil' }, h('h3', null, 'Teilschritt 2 · Umfang'), h('p', { class: 'dc-frage' }, T.que_4_wie));
    if (q.zeitraeume.length) {
      teil2.append(h('p', null, h('strong', null, 'Nach Zeitraum')));
      q.zeitraeume.forEach((z, i) => teil2.append(h('div', { class: 'dc-zeile' },
        h('label', { for: `zv${i}` }, `Zeitraum #${i + 1}`),
        textfeld(ctx, `zv${i}`, z.von, (v) => { z.von = v; }, { id: `zv${i}`, class: 'dc-input dc-input--datum', placeholder: 'TT.MM.JJJJ', inputmode: 'numeric', 'aria-label': `Zeitraum #${i + 1} von` }),
        '–',
        textfeld(ctx, `zb${i}`, z.bis, (v) => { z.bis = v; }, { class: 'dc-input dc-input--datum', placeholder: 'TT.MM.JJJJ', inputmode: 'numeric', 'aria-label': `Zeitraum #${i + 1} bis` }))));
    }
    if (q.zeitraeume.length && q.faelle.length) teil2.append(h('p', null, h('em', { class: 'texthervorhebung' }, 'und')));
    if (q.faelle.length) {
      teil2.append(h('p', null, h('strong', null, 'Nach Fallnummer')));
      q.faelle.forEach((f, i) => teil2.append(h('div', { class: 'dc-zeile' },
        h('label', { for: `f${i}` }, `Fall #${i + 1}`),
        textfeld(ctx, `f${i}`, f, (v) => { q.faelle[i] = v; }, { id: `f${i}`, placeholder: 'Fallnummer' }))));
    }
    const beruehrt = q.zeitraeume.some((z) => z.von || z.bis) || q.faelle.some((f) => f);
    if (beruehrt || q.umfangBestaetigt) teil2.append(fehlerliste(umfang.fehler));
    if (!q.umfangBestaetigt) {
      teil2.append(h('div', { class: 'dc-aktionen' }, knopf('Fertig und weiter', () => { q.umfangBestaetigt = true; ctx.aktualisieren(); }, !umfang.ok, { 'data-key': 'q4_fertig' })));
      return h('div', null, teil1, teil2);
    }

    // Teilschritt 3: Was
    const teil3 = h('div', { class: 'dc-teil' },
      h('h3', null, 'Teilschritt 3 · Was'),
      h('p', { class: 'dc-frage' }, T.que_4_was),
      ['komplett', 'teile'].map((w) => h('label', { class: 'dc-wahl' },
        h('input', { type: 'radio', name: 'q4art', value: w, checked: q.art === w, 'data-key': 'q4art_' + w, onchange: () => { q.art = w; ctx.aktualisieren(); } }),
        h('span', null, w === 'komplett' ? T.que_4_komplett : T.que_4_teile))));
    if (q.art === 'teile') {
      teil3.append(h('textarea', {
        class: 'dc-input', rows: '3', 'data-key': 'q4teile', 'aria-label': 'Welche Teile des Umfangs?', placeholder: 'Welche Teile? (z. B. nur Pflegeanamnese)',
        oninput: (e) => { q.teileText = e.target.value; ctx.aktualisieren(); },
      }, q.teileText));
    }
    if (!q.weiter) teil3.append(h('div', { class: 'dc-aktionen' }, knopf('Weiter', () => { q.weiter = true; ctx.aktualisieren(); }, !L.pruefeArt(q).ok, { 'data-key': 'q4_weiter' })));
    return h('div', null, teil1, teil2, teil3);
  };

  R.que_5 = (ctx) => {
    const q = ctx.z.que_5;
    return h('div', null,
      h('p', { class: 'dc-frage' }, T.que_5),
      ['entlassen', 'aktuell', 'gemischt'].map((w) => h('label', { class: 'dc-wahl' },
        h('input', { type: 'radio', name: 'q5', value: w, checked: q.status === w, 'data-key': 'q5_' + w, onchange: () => { q.status = w; L.bereinigeSysteme(ctx.z); ctx.aktualisieren(); } }),
        h('span', null, w))),
      q.weiter ? null : h('div', { class: 'dc-aktionen' }, knopf('Weiter', () => { q.weiter = true; ctx.aktualisieren(); }, !q.status, { 'data-key': 'q5_weiter' })));
  };

  R.que_6 = (ctx) => {
    const q = ctx.z.que_6, spalten = L.aktiveSpalten(ctx.z.que_5.status), p = L.pruefeSysteme(q, ctx.z.que_5.status, ctx.optionen);
    const tabelle = h('table', { class: 'dc-tabelle' },
      h('caption', { class: 'sr-only' }, 'Dokumentationssysteme je Fallstatus'),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, L.treeName(ctx.z.que_5.status)), spalten.map((s) => h('th', { scope: 'col' }, s)))),
      h('tbody', null, L.KONFIG.systeme.map((sys) => h('tr', null,
        h('th', { scope: 'row' }, sys),
        spalten.map((sp) => h('td', null, h('input', {
          type: 'checkbox', checked: q[sp][sys], 'data-key': `q6_${sp}_${sys}`, 'aria-label': `${sys} ${sp}`,
          onchange: (e) => { q[sp][sys] = e.target.checked; ctx.aktualisieren(); },
        })))))));
    return h('div', null,
      h('p', { class: 'dc-frage' }, T.que_6),
      spalten.length === 2 && ctx.optionen.strengGemischt ? h('p', null, 'Bei „gemischt“: je Spalte (entlassen und aktuell) mindestens ein System wählen.') : null,
      tabelle,
      q.weiter ? fehlerliste(p.fehler) : null,
      q.weiter ? null : h('div', { class: 'dc-aktionen' }, knopf('Weiter', () => { q.weiter = true; ctx.aktualisieren(); }, !p.ok, { 'data-key': 'q6_weiter' })));
  };

  const mitTrotzdem = (feld, text, vorher) => (ctx) => h('div', null,
    vorher ? vorher() : null,
    jaNein(ctx, feld, text),
    ctx.z[feld] === 'n' ? h('div', { class: 'dc-teil' }, jaNein(ctx, feld + '_trotzdem', T.trotzdem)) : null,
    ctx.hinweise[feld + '_trotzdem'] ? meldung('info', ctx.hinweise[feld + '_trotzdem']) : null);

  R.que_7 = mitTrotzdem('que_7', T.que_7);
  R.que_8 = (ctx) => h('div', null,
    h('p', { class: 'dc-frage' }, T.que_8),
    h('ul', null, L.KONFIG.kategorien.map((k) => h('li', null, k))),
    mitTrotzdem('que_8', 'Antwort:')(ctx));
  R.que_9 = mitTrotzdem('que_9', T.que_9);
  R.que_10 = (ctx) => jaNein(ctx, 'que_10', T.que_10);

  /* ---------- Größere Bausteine ---------- */
  function schrittKarte(ctx, schritt, klasse) {
    const nr = +schritt.id.split('_')[1];
    return h('section', { class: 'dc-karte ' + klasse, id: 'karte_' + schritt.id, 'aria-labelledby': 'h_' + schritt.id },
      h('div', { class: 'dc-schrittnr' }, `Frage ${nr} von 10`),
      h('h2', { id: 'h_' + schritt.id }, schritt.titel),
      R[schritt.id](ctx));
  }

  function speicherLeiste(ctx) {
    const kannSpeichern = L.berichtAngelegt(ctx.z);
    return h('div', { class: 'dc-speicherstatus' },
      h('span', { 'data-speicherinfo': true, role: 'status' }, ctx.speicherInfo),
      h('span', { class: 'dc-aktionen', style: 'margin:0' },
        kannSpeichern && S.ordnerZugriffMoeglich() && !S.ordner
          ? h('button', { type: 'button', class: 'dc-btn dc-btn--sekundaer dc-btn--klein', onclick: async () => { const r = await S.ordnerWaehlen(); if (r.ok) await ctx.jetztSpeichern(); } }, 'Ordner wählen')
          : null,
        h('button', { type: 'button', class: 'dc-btn dc-btn--sekundaer dc-btn--klein', disabled: !kannSpeichern, onclick: ctx.herunterladen }, 'Bericht herunterladen')));
  }

  function abbruchKarte(ctx, text, korrigieren) {
    return h('section', { class: 'dc-karte dc-karte--abbruch', role: 'alert' },
      h('h2', null, 'Checkliste abgebrochen'),
      meldung('warnung', text),
      h('div', { class: 'dc-aktionen' },
        korrigieren ? knopf('Antwort korrigieren', korrigieren, false, { class: 'dc-btn dc-btn--sekundaer' }) : null,
        knopf('Neu beginnen', ctx.neuStarten)));
  }

  function endeKarte(ctx) {
    return h('section', { class: 'dc-karte dc-karte--erledigt' },
      h('h2', null, 'Abschlussbericht'),
      meldung('ok', S.ordner ? `Final gespeichert in „${S.ordner.name}/${L.KONFIG.dateiname}“.` : 'Checkliste abgeschlossen. Bitte Bericht herunterladen und in den Zielordner legen.'),
      h('pre', { class: 'dc-bericht', 'data-bericht': true }, L.berichtText(ctx.z, new Date(), ctx.optionen)),
      h('div', { class: 'dc-aktionen' },
        knopf('Bericht herunterladen', ctx.herunterladen),
        knopf('Neue Checkliste', ctx.neuStarten, false, { class: 'dc-btn dc-btn--sekundaer' })));
  }

  root.DokuUI = { h, erstelleController, schrittKarte, speicherLeiste, abbruchKarte, endeKarte, meldung, renderer: R };
})(typeof self !== 'undefined' ? self : this);
