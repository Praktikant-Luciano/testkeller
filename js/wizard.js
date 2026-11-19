/*
 * Variante A – Schritt-für-Schritt-Wizard
 * Zeigt immer nur die aktuelle Frage. Entspricht 1:1 dem Ablauf der Vorlage.
 */
(function () {
  'use strict';
  const { h, erstelleController, schrittKarte, speicherLeiste, abbruchKarte, endeKarte } = window.DokuUI;
  let letzterSchritt = null;

  function render(ctx) {
    const e = ctx.auswertung;
    const fertig = e.schritte.filter((s) => s.status === 'erledigt').length;
    const aktuell = e.schritte[e.schritte.length - 1];

    const fortschritt = h('ol', { class: 'dc-fortschritt', 'aria-hidden': 'true' },
      window.DokuLogik.SCHRITTE.map((s, i) => h('li', { class: i < fertig ? 'erledigt' : i === fertig && !e.ende ? 'aktiv' : '' })));
    const text = h('p', { class: 'dc-fortschritt-text' },
      e.ende ? 'Alle 10 Schritte erledigt' : `Schritt ${fertig + 1} von 10 · ${aktuell.titel}`);

    let inhalt;
    if (e.abbruch) {
      inhalt = abbruchKarte(ctx, e.abbruch, () => {
        // Fehlklick-Schutz: letzte Antwort zurücknehmen statt alles neu
        ctx.z[e.aktuell] = null;
        ctx.aktualisieren();
      });
    } else if (e.ende) {
      inhalt = endeKarte(ctx);
    } else {
      inhalt = schrittKarte(ctx, aktuell, 'dc-karte--aktiv');
    }
    return h('div', null, fortschritt, text, speicherLeiste(ctx), inhalt);
  }

  const ctx = erstelleController({
    wurzel: document.getElementById('app'),
    render,
    nachRender(c) {
      // Bei Schrittwechsel Fokus auf die neue Überschrift (Screenreader/Tastatur)
      const id = c.auswertung.ende ? 'ende' : c.auswertung.abbruch ? 'abbruch' : c.auswertung.aktuell;
      if (letzterSchritt !== null && id !== letzterSchritt) {
        const h2 = document.querySelector('#app h2');
        if (h2) { h2.setAttribute('tabindex', '-1'); h2.focus(); }
      }
      letzterSchritt = id;
    },
  });
  ctx.aktualisieren();
})();
