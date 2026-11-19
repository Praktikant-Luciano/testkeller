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
        ? 'Ordnerzugriff verfügbar: Bei „Erledigt“ (Schritt 3) Zielordner wählen.'
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

  R.que_2 = (ctx) => h('div', null,
    jaNein(ctx, 'que_2', T.que_2),
    ctx.z.que_2 === 'n' ? h('div', { class: 'dc-teil' }, jaNein(ctx, 'sub_que_2', T.sub_que_2)) : null);

  R.que_3 = (ctx) => {
    const q = ctx.z.que_3, teile = [];
    // Teil 1: Ordner
    teile.push(h('p', { class: 'dc-frage' }, 'Ordner anlegen unter ',
      h('a', { href: L.KONFIG.explorerLink, target: '_blank', rel: 'noopener' }, '(Explorer-Link tba)'),
      ' und eindeutig benennen und Pfad zum Ordner hier eingeben:'));
    teile.push(h('div', { class: 'dc-zeile' },
      h('label', { for: 'pfad' }, 'Ordnerpfad'),
      textfeld(ctx, 'pfad', q.ordnerPfad, (v) => { q.ordnerPfad = v; }, { id: 'pfad', readonly: q.ordnerErledigt, placeholder: 'z. B. \\\\server\\PDok\\2026-001' })));
    if (!q.ordnerErledigt) {
      teile.push(h('div', { class: 'dc-aktionen' }, knopf('Erledigt', async () => {
        if (S.ordnerZugriffMoeglich()) {
          const r = await S.ordnerWaehlen();
          if (!r.ok) {
            ctx.speicherInfo = r.grund === 'abgebrochen' || r.grund === 'abgelehnt'
              ? 'Kein Zielordner gewählt. Bericht wird als Download bereitgestellt (oder erneut „Ordner wählen“).'
              : 'Ordnerzugriff fehlgeschlagen. Bericht wird als Download bereitgestellt.';
          }
        }
        q.ordnerErledigt = true;
        ctx.z.meta.erstellt = new Date().toISOString();
        ctx.aktualisieren();
        if (S.ordner) await ctx.jetztSpeichern();
      }, q.ordnerPfad.trim() === '', { 'data-key': 'ordner_erledigt' })));
      return h('div', null, teile);
    }
    teile.push(meldung('ok', S.ordner
      ? `${L.KONFIG.dateiname} im gewählten Ordner „${S.ordner.name}“ angelegt.`
      : `${L.KONFIG.dateiname} angelegt (im Browser; Download über „Bericht herunterladen“).`));

    // Teil 2: Ticket
    const t2 = h('div', { class: 'dc-teil' },
      h('p', { class: 'dc-frage' }, T.que_3_ticket + ' ',
        h('a', { href: L.KONFIG.ticketSystemLink, target: '_blank', rel: 'noopener' }, 'Zum Ticket-System (Dummy-Link)')));
    if (!q.ticketErledigt) {
      t2.append(h('div', { class: 'dc-aktionen' }, knopf('Erledigt', () => { q.ticketErledigt = true; ctx.aktualisieren(); }, false, { 'data-key': 'ticket_erledigt' })));
      teile.push(t2);
      return h('div', null, teile);
    }
    t2.append(meldung('ok', 'Ticket angelegt und zugewiesen.'));
    teile.push(t2);

    // Teil 3: sub_que_3
    const t3 = h('div', { class: 'dc-teil' });
    t3.append(h('p', { class: 'dc-frage', id: 'lbl_sq3' }, T.sub_que_3),
      h('div', { class: 'dc-jn', role: 'group', 'aria-labelledby': 'lbl_sq3' },
        ['y', 'n'].map((w) => h('button', {
          type: 'button', class: 'dc-btn', 'aria-pressed': String(q.linkDokumentieren === w), 'data-key': 'sq3_' + w,
          onclick: () => { q.linkDokumentieren = w; if (w === 'n') q.linkGespeichert = false; ctx.aktualisieren(); },
        }, w === 'y' ? 'Ja' : 'Nein'))));
    if (q.linkDokumentieren === 'y') {
      t3.append(h('div', { class: 'dc-zeile' },
        h('label', { for: 'ticketlink' }, 'Ticket-Link'),
        textfeld(ctx, 'ticketlink', q.ticketLink, (v) => { q.ticketLink = v; q.linkGespeichert = false; }, { id: 'ticketlink', type: 'url' })),
      h('div', { class: 'dc-aktionen' }, knopf('Speichern in Abschlussbericht.txt', async () => {
        q.linkGespeichert = true; ctx.aktualisieren(); if (S.ordner) await ctx.jetztSpeichern();
      }, q.ticketLink.trim() === '', { 'data-key': 'link_speichern' })));
      if (q.linkGespeichert) t3.append(meldung('ok', T.sub_que_3_ja));
    }
    if (q.linkDokumentieren === 'n') t3.append(meldung('info', T.sub_que_3_nein));
    teile.push(t3);

    const offen = L.pruefeSchritt('que_3', Object.assign({}, ctx.z, { que_3: Object.assign({}, q, { weiter: true }) }));
    if (!q.weiter) teile.push(h('div', { class: 'dc-aktionen' }, knopf('Weiter', () => { q.weiter = true; ctx.aktualisieren(); }, offen.status !== 'erledigt', { 'data-key': 'q3_weiter' })));
    return h('div', null, teile);
  };

  R.que_4 = (ctx) => {
    const q = ctx.z.que_4, max = L.KONFIG.maxZeilen, umfang = L.pruefeUmfang(q);
    const zeilen = (liste, art) => liste.map((eintrag, i) => {
      const entfernen = liste.length > 1
        ? h('button', { type: 'button', class: 'dc-btn dc-btn--sekundaer dc-btn--klein', 'aria-label': `${art} #${i + 1} entfernen`, onclick: () => { liste.splice(i, 1); ctx.aktualisieren(); } }, '−')
        : null;
      if (art === 'Zeitraum') {
        return h('div', { class: 'dc-zeile' },
          h('label', { for: `zv${i}` }, `Zeitraum #${i + 1}`),
          textfeld(ctx, `zv${i}`, eintrag.von, (v) => { eintrag.von = v; }, { id: `zv${i}`, class: 'dc-input dc-input--datum', placeholder: 'TT.MM.JJJJ', inputmode: 'numeric', 'aria-label': `Zeitraum #${i + 1} von` }),
          '–',
          textfeld(ctx, `zb${i}`, eintrag.bis, (v) => { eintrag.bis = v; }, { class: 'dc-input dc-input--datum', placeholder: 'TT.MM.JJJJ', inputmode: 'numeric', 'aria-label': `Zeitraum #${i + 1} bis` }),
          entfernen);
      }
      return h('div', { class: 'dc-zeile' },
        h('label', { for: `f${i}` }, `Fall #${i + 1}`),
        textfeld(ctx, `f${i}`, eintrag, (v) => { liste[i] = v; }, { id: `f${i}`, placeholder: 'Fallnummer' }),
        entfernen);
    });
    const plus = (liste, neu, art) => h('button', {
      type: 'button', class: 'dc-btn dc-btn--sekundaer dc-btn--klein', disabled: liste.length >= max,
      'data-key': 'plus_' + art, 'aria-label': `${art} hinzufügen`, onclick: () => { liste.push(neu()); ctx.aktualisieren(); },
    }, '+ ' + art);

    const teil1 = h('div', null,
      h('p', { class: 'dc-frage' }, T.que_4_wie),
      h('h3', null, 'Nach Zeitraum'), zeilen(q.zeitraeume, 'Zeitraum'), plus(q.zeitraeume, () => ({ von: '', bis: '' }), 'Zeitraum'),
      h('p', null, h('em', { class: 'texthervorhebung' }, 'und/oder')),
      h('h3', null, 'Nach Fallnummer'), zeilen(q.faelle, 'Fall'), plus(q.faelle, () => '', 'Fall'),
      fehlerliste(umfang.fehler));
    if (!q.umfangBestaetigt) {
      teil1.append(h('div', { class: 'dc-aktionen' }, knopf('Fertig und weiter', () => { q.umfangBestaetigt = true; ctx.aktualisieren(); }, !umfang.ok, { 'data-key': 'q4_fertig' })));
      return teil1;
    }
    const teil2 = h('div', { class: 'dc-teil' },
      h('p', { class: 'dc-frage' }, T.que_4_was),
      ['komplett', 'teile'].map((w) => h('label', { class: 'dc-wahl' },
        h('input', { type: 'radio', name: 'q4art', value: w, checked: q.art === w, 'data-key': 'q4art_' + w, onchange: () => { q.art = w; ctx.aktualisieren(); } }),
        h('span', null, w === 'komplett' ? T.que_4_komplett : T.que_4_teile))));
    if (q.art === 'teile') {
      teil2.append(h('textarea', {
        class: 'dc-input', rows: '3', 'data-key': 'q4teile', 'aria-label': 'Welche Teile des Umfangs?', placeholder: 'Welche Teile? (z. B. nur Pflegeanamnese)',
        oninput: (e) => { q.teileText = e.target.value; ctx.aktualisieren(); },
      }, q.teileText));
    }
    if (!q.weiter) teil2.append(h('div', { class: 'dc-aktionen' }, knopf('Weiter', () => { q.weiter = true; ctx.aktualisieren(); }, !L.pruefeArt(q).ok, { 'data-key': 'q4_weiter' })));
    return h('div', null, teil1, teil2);
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
      h('div', { class: 'dc-schrittnr' }, `Schritt ${nr} von 10`),
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
