# Logik-Analyse Dokucheckliste PDok (Vorlage v2)

Legende: 🔴 Widerspruch/Lücke mit Risiko · 🟡 Unklarheit · 🟢 Verbesserung
„Umgesetzt“ = im Code gelöst · „Annahme“ = meine Auslegung, bitte bestätigen · „Offen“ = Entscheidung nötig

## 1. Gefundene Schwachstellen

| # | Stelle | Problem | Status |
|---|--------|---------|--------|
| 1 🔴 | que_1 | Frage ist doppelt („legitim **oder** Rückfragen nötig?“). „Ja“ kann beides heißen, die Logik behandelt Ja aber als „legitim“. | Offen – Vorschlag: „Ist die Anfrage legitim und vollständig? (y/n)“ |
| 2 🔴 | que_2 | „teilweise“ steht in der Frage (→ Ja) **und** im Nein-Text („nicht oder nur teilweise zuständig“). Teilzuständigkeit landet je nach Lesart in beiden Ästen. | Offen – Vorschlag: 3 Optionen „ganz / teilweise / gar nicht“ |
| 3 🔴 | que_1, sub_que_2 | Abbruch passiert **vor** que_3 → es entsteht kein Abschlussbericht. Abgelehnte Anfragen sind damit nicht dokumentiert. | Offen – Vorschlag: Kurzbericht „Abgebrochen“ erlauben |
| 4 🔴 | que_3 | Browser können **nicht** in einen eingetippten Pfad schreiben. | Umgesetzt: Ordnerwahl per Dialog (Chrome/Edge) oder Download (Firefox/Safari). Pfad wird nur im Bericht dokumentiert. |
| 5 🔴 | que_5 ↔ que_6 | Text sagt bei „gemischt“: „tree_1 und tree_2“, die Tabelle definiert aber **tree_3**. | Annahme: tree_3 (eine Tabelle, 2 Spalten) |
| 6 🔴 | que_6 (tree_3) | „gemischt“ freigeschaltet schon mit **1** Haken, z. B. nur „entlassen“. Dann ist „gemischt“ fachlich nicht abgebildet. | Umgesetzt wie Vorlage (1 Haken). Strenge Regel „≥1 je Spalte“ per Option `strengGemischt` verfügbar. Offen: welche gilt? |
| 7 🔴 | que_9 | „Export nicht ausgeführt → trotzdem fortfahren“ führt direkt zu „Ticket schließen“. Ein Ticket ohne Export zu schließen widerspricht dem Zweck. | Offen – Vorschlag: bei que_9 kein „Trotzdem“, oder Pflicht-Begründung |
| 8 🟡 | que_7/8/9 | „Trotzdem fortfahren“ ohne Begründung. Im Bericht ist nicht erkennbar, **warum**. | Umgesetzt: Bericht markiert „TROTZDEM FORTGEFAHREN“. Offen: Pflicht-Freitext Begründung |
| 9 🟡 | que_7/8/9 n→n, que_10 n | „in que_x bleiben“ / „zurück zu que_10“ = Schleife ohne Ausstieg (z. B. Ticket kann nicht geschlossen werden). | Offen – Vorschlag: Button „Pausieren/Zwischenstand speichern“ |
| 10 🟡 | que_4 | Datumsregeln fehlen: Format, echtes Datum, Von ≤ Bis, halb ausgefüllte Zeilen, doppelte Fallnummern. | Umgesetzt: alle geprüft; leere Zeilen werden ignoriert |
| 11 🟡 | que_4 | Fallnummer-Format unbekannt (Länge, nur Ziffern?). | Annahme: beliebiger Text, nicht leer |
| 12 🟡 | que_4 ↔ que_5 | Fallstatus ist bei mehreren Fällen/Zeiträumen pro **Anfrage**, nicht pro Fall. Bei „gemischt“ ist unklar, welcher Fall welchen Status hat. | Offen |
| 13 🟡 | que_6 | Kein Fragetext, keine Erklärung der Kürzel (MV5, MV6, NICE, U). | Annahme: „Welche Dokumentationssysteme sind betroffen?“ |
| 14 🟡 | que_8 | Kategorienliste ist „tba“. | Platzhalter in `KONFIG.kategorien` |
| 15 🟡 | Allgemein | Keine Rückwärts-Navigation definiert. Fehlklick bei que_1 = sofortiger Abbruch. | Umgesetzt: Variante A „Antwort korrigieren“, Variante B jederzeit editierbar |
| 16 🟡 | Allgemein | Bericht-Inhalt nur teilweise definiert (que_4–6 „dokumentieren“). | Annahme: alle Antworten + Zeitstempel + Status |
| 17 🟢 | Bericht | Kein Bearbeiter-Name im Bericht. | Offen – Vorschlag: Feld „Bearbeitet von“ in que_3 |
| 18 🟢 | que_3 | Ordnerpfad nach „Erledigt“ nicht mehr änderbar (sonst stimmt Bericht ≠ Ablageort). | Umgesetzt (schreibgeschützt) |
| 19 🟢 | Datenschutz | Fallnummern = personenbezogene Gesundheitsdaten (⚠ nicht verifiziert, bitte mit DSB klären). | Umgesetzt: **keine** Speicherung im Browser (kein localStorage). Nachteil: Neuladen = Daten weg (Warnung beim Schließen). |
| 20 🟢 | CI | SALK-Grün auf Weiß hat nur 2,2:1 Kontrast (WCAG verlangt 4,5:1). | Umgesetzt: Grün nur für Flächen/Rahmen, nie als Text |

## 2. Wichtigste Empfehlungen (Top 5)
1. **que_1 und que_2 umformulieren** (#1, #2) – sonst unterschiedliche Auslegung je Bearbeiter.
2. **Abbrüche dokumentieren** (#3) – auch abgelehnte Anfragen brauchen einen Nachweis.
3. **que_9: kein Schließen ohne Export** (#7).
4. **„Trotzdem“ nur mit Begründung** (#8) – macht den Bericht revisionsfähig.
5. **Regel für „gemischt“ festlegen** (#6) – Schalter existiert bereits.

## 3. Browser-Einschränkung Dateiablage (verifiziert)
- **Chrome / Edge:** File System Access API (`showDirectoryPicker`). Nutzer wählt den Ordner einmal; die Seite legt `Abschlussbericht.txt` an und aktualisiert sie nach jeder Änderung. Funktioniert über `https://` und lokal per `file://` (lokal: ⚠ nicht in jeder Unternehmens-Konfiguration geprüft, Gruppenrichtlinien können die API sperren).
- **Firefox / Safari:** API nicht vorhanden → Download in den Download-Ordner, Nutzer verschiebt die Datei selbst.
- Netzlaufwerke (`\\server\…`): im Ordnerdialog wählbar, sofern im Explorer verbunden (⚠ nicht getestet).
