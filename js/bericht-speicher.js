/*
 * Speichern von Abschlussbericht.txt im Browser.
 *
 * Wichtig: Ein Browser darf NICHT in einen eingetippten Pfad (z. B. \\server\share\...) schreiben.
 * Möglich sind nur:
 *  1) File System Access API (Chromium: Chrome, Edge): Nutzer wählt den Zielordner einmal per Dialog,
 *     danach kann die Seite Abschlussbericht.txt dort anlegen und aktualisieren.
 *  2) Fallback (Firefox, Safari, ältere Browser): Download der Datei; Nutzer verschiebt sie selbst.
 */
(function (root) {
  'use strict';
  const BOM = '\uFEFF'; // UTF-8-BOM, damit Umlaute auch in älteren Editoren korrekt erscheinen

  const BerichtSpeicher = {
    ordner: null,
    dateiname: 'Abschlussbericht.txt',

    /** true, wenn direktes Schreiben in einen Ordner möglich ist. */
    ordnerZugriffMoeglich() {
      return typeof root.showDirectoryPicker === 'function' && root.isSecureContext !== false;
    },

    /** Öffnet den Ordnerdialog (muss aus einem Klick heraus aufgerufen werden). */
    async ordnerWaehlen() {
      if (!this.ordnerZugriffMoeglich()) return { ok: false, grund: 'nicht-unterstuetzt' };
      try {
        const dir = await root.showDirectoryPicker({ id: 'pdok-bericht', mode: 'readwrite' });
        // Vorhandene Datei nicht stillschweigend überschreiben
        let existiert = false;
        try { await dir.getFileHandle(this.dateiname); existiert = true; } catch (_) { /* existiert nicht */ }
        if (existiert && !root.confirm(`${this.dateiname} existiert in diesem Ordner bereits. Überschreiben?`)) {
          return { ok: false, grund: 'abgelehnt' };
        }
        this.ordner = dir;
        return { ok: true, name: dir.name };
      } catch (e) {
        return { ok: false, grund: e && e.name === 'AbortError' ? 'abgebrochen' : 'fehler', fehler: e };
      }
    },

    /** Schreibt den kompletten Bericht in den gewählten Ordner. */
    async schreiben(text) {
      if (!this.ordner) return { ok: false, grund: 'kein-ordner' };
      try {
        const fh = await this.ordner.getFileHandle(this.dateiname, { create: true });
        const w = await fh.createWritable();
        await w.write(BOM + text);
        await w.close();
        return { ok: true };
      } catch (e) {
        return { ok: false, grund: 'fehler', fehler: e };
      }
    },

    /** Fallback: Datei herunterladen. */
    herunterladen(text) {
      const blob = new Blob([BOM + text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = this.dateiname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { ok: true };
    },

    zuruecksetzen() { this.ordner = null; },
  };

  root.BerichtSpeicher = BerichtSpeicher;
})(typeof self !== 'undefined' ? self : this);
