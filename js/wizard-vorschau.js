/*
 * Variante 2 – Schritt für Schritt mit Live-Vorschau
 * Links: immer nur die aktuelle Frage (wie wizard.js).
 * Rechts (schmale Bildschirme: darunter): Live-Vorschau von Abschlussbericht.txt,
 * aktualisiert sich bei jeder Eingabe. Am Ende ersetzt die Abschlusskarte die Vorschau.
 */
(function () {
  'use strict';
  const L = window.DokuLogik;
  const { h, erstelleController, schrittKarte, speicherLeiste, abbruchKarte, endeKarte } = window.DokuUI;
  let letzterSchritt = null;
  let vorschauOffen = true; // Auf-/Zuklappen bleibt beim Neuzeichnen erhalten

  function vorschau(ctx) {
    const angelegt = L.berichtAngelegt(ctx.z);
    const details = h('details', { class: 'dc-vorschau', open: vorschauOffen, ontoggle: (e) => { vorschauOffen = e.target.open; } },
      h('summary', null, 'Vorschau ' + L.KONFIG.dateiname),
      angelegt
        ? h('pre', { class: 'dc-bericht', 'data-vorschau': true, 'aria-live': 'off' }, L.berichtText(ctx.z, new Date(), ctx.optionen))
        : h('p', { class: 'dc-vorschau-leer' }, 'Der Bericht wird in Frage 3 angelegt („Erledigt“ beim Ordnernamen). Ab dann erscheint hier sein Inhalt.'));
    return h('aside', { class: 'dc-seite dc-vorschau-spalte', 'aria-label': 'Vorschau Abschlussbericht' }, details);
  }

  function render(ctx) {
    const e = ctx.auswertung;
    const fertig = e.schritte.filter((s) => s.status === 'erledigt').length;
    const aktuell = e.schritte[e.schritte.length - 1];

    const fortschritt = h('ol', { class: 'dc-fortschritt', 'aria-hidden': 'true' },
      L.SCHRITTE.map((s, i) => h('li', { class: i < fertig ? 'erledigt' : i === fertig && !e.ende ? 'aktiv' : '' })));
    const text = h('p', { class: 'dc-fortschritt-text' },
      e.ende ? 'Alle 10 Fragen erledigt' : `Frage ${fertig + 1} von 10 · ${aktuell.titel}`);

    let inhalt;
    if (e.abbruch) {
      inhalt = abbruchKarte(ctx, e.abbruch, () => { ctx.z[e.aktuell] = null; ctx.aktualisieren(); });
    } else if (e.ende) {
      inhalt = endeKarte(ctx);
    } else {
      inhalt = schrittKarte(ctx, aktuell, 'dc-karte--aktiv');
    }
    const links = h('div', null, fortschritt, text, speicherLeiste(ctx), inhalt);
    // Am Ende zeigt die Abschlusskarte den Bericht bereits vollständig -> keine doppelte Vorschau
    return e.ende ? links : h('div', { class: 'dc-raster-vorschau' }, links, vorschau(ctx));
  }

  const ctx = erstelleController({
    wurzel: document.getElementById('app'),
    render,
    nachRender(c) {
      const id = c.auswertung.ende ? 'ende' : c.auswertung.abbruch ? 'abbruch' : c.auswertung.aktuell;
      if (letzterSchritt !== null && id !== letzterSchritt) {
        const h2 = document.querySelector('#app .dc-karte h2');
        if (h2) { h2.setAttribute('tabindex', '-1'); h2.focus(); }
      }
      letzterSchritt = id;
      // Neueste Zeile der Vorschau sichtbar halten
      const pre = document.querySelector('[data-vorschau]');
      if (pre) pre.scrollTop = pre.scrollHeight;
    },
  });
  ctx.aktualisieren();
})();
