/*
 * Variante B – Lineares Formular mit Übersicht
 * Alle erreichten Schritte bleiben sichtbar und änderbar. Spätere Schritte werden erst
 * freigeschaltet, wenn der vorherige gültig ist. Ändert man eine frühere Antwort so,
 * dass sie ungültig wird, werden die späteren Schritte wieder gesperrt.
 * Rechts: Live-Vorschau von Abschlussbericht.txt.
 */
(function () {
  'use strict';
  const L = window.DokuLogik;
  const { h, erstelleController, schrittKarte, speicherLeiste, abbruchKarte, endeKarte } = window.DokuUI;

  function render(ctx) {
    const e = ctx.auswertung;
    const sichtbar = new Map(e.schritte.map((s) => [s.id, s]));

    const nav = h('ol', { class: 'dc-nav', 'aria-label': 'Fortschritt' }, L.SCHRITTE.map((s, i) => {
      const st = sichtbar.get(s.id);
      const klasse = !st ? 'gesperrt' : st.status === 'erledigt' || st.status === 'ende' ? 'erledigt' : 'aktiv';
      const text = `${i + 1}. ${s.titel}`;
      return h('li', { class: klasse }, st ? h('a', { href: '#karte_' + s.id }, text) : text);
    }));

    const karten = e.schritte.map((s) => schrittKarte(ctx, s,
      s.status === 'erledigt' || s.status === 'ende' ? 'dc-karte--erledigt' : s.status === 'abbruch' ? 'dc-karte--abbruch' : 'dc-karte--aktiv'));
    if (e.abbruch) karten.push(abbruchKarte(ctx, e.abbruch));
    if (e.ende) karten.push(endeKarte(ctx));

    const vorschau = h('aside', { class: 'dc-seite', 'aria-label': 'Vorschau Abschlussbericht' },
      h('div', { class: 'dc-karte' },
        h('h2', null, 'Vorschau ' + L.KONFIG.dateiname),
        L.berichtAngelegt(ctx.z)
          ? h('pre', { class: 'dc-bericht' }, L.berichtText(ctx.z, new Date(), ctx.optionen))
          : h('p', null, 'Wird in Schritt 3 angelegt.')));

    return h('div', { class: 'dc-raster' },
      h('nav', { class: 'dc-seite' }, nav),
      h('div', null, speicherLeiste(ctx), karten),
      vorschau);
  }

  erstelleController({ wurzel: document.getElementById('app'), render }).aktualisieren();
})();
