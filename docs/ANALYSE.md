# Logik-Analyse Dokucheckliste PDok

## 0. Prüfung Vorlage v3_nutzer (19.11.2026) – aktueller Stand
Legende: 🔴 Lücke mit Risiko · 🟡 Unklarheit · ✅ so umgesetzt

| # | Stelle | Befund | Umsetzung |
|---|--------|--------|-----------|
| N1 🟡 | Kopf | „alle sub_que_x zu F“ – Satz bricht ab. Es gibt aktuell keine sub_que mehr. | Ohne Wirkung. Bitte ergänzen, falls künftig Unterfragen kommen. |
| N2 🔴 | Frage 3 | Ordnername wird nicht mehr abgefragt. Der Bericht kennt den Ordner nur, wenn er im Dialog gewählt wurde (Chrome/Edge). | ✅ Bericht: Ablage = Zielpfad + gewählter Ordner, sonst „&lt;Ordnername nicht erfasst&gt;“. Empfehlung: Feld „Ordnername“. |
| N3 🔴 | Frage 3 | Ticket-Link/-Nummer wird nicht mehr dokumentiert → Bericht und Ticket sind nicht verknüpft. | Empfehlung: Pflichtfeld „Ticketnummer“. |
| N4 🟡 | Frage 3 | Pfad G:\… kann ein Browser weder öffnen noch anlegen. | ✅ Pfad wird angezeigt + Button „Pfad kopieren“ (für den Explorer). |
| N5 🟡 | Frage 3 | Serviceware-Link ist nur im Kliniknetz erreichbar. | ✅ Eingebaut, ⚠ nicht getestet (kein Zugriff). |
| N6 🔴 | Frage 4 TS 2 | Vorlage nennt noch „+“-Button und „5 Zeilen max.“ – widerspricht der festen Anzahl aus Teilschritt 1. | ✅ Annahme: genau so viele Zeilen wie in TS 1 angegeben, kein „+“. |
| N7 🟡 | Frage 4 TS 2 | „ausgegraut, bis eine der beiden Informationen vorhanden ist“ – bei fester Anzahl unklar. | ✅ Annahme: **alle** angekündigten Zeilen müssen gültig sein. |
| N8 🟡 | Frage 4 TS 1 | Ungültige Eingaben (z. B. 7, Buchstaben) nicht geregelt. | ✅ Nur 0–5, sonst Hinweis und Button gesperrt. |
| N9 🟡 | Frage 5/6 | Text: „gemischt → tree_1 und tree_2“, Tabelle: tree_3. | ✅ Gleiche Wirkung (beide Spalten). |
| N10 🟡 | Frage 6 | Bei „gemischt“ reicht 1 Haken (z. B. nur „entlassen“). | ✅ Laut Vorlage umgesetzt. Strenge Regel per Option abrufbar. |
| N11 🟡 | Frage 8 | Kategorien wieder „… tba“. | ✅ So angezeigt. Liste wird nachgereicht. |
| N12 🟡 | Frage 9 | „Trotzdem fortfahren“ erlaubt Ticketschluss ohne Export. | ✅ Laut Vorlage umgesetzt. Bericht markiert „TROTZDEM FORTGEFAHREN“. |
| N13 ✅ | Anzeige | que_x → „Frage x“, (y/n) → (Ja/Nein). | Umgesetzt (Oberfläche + Bericht). |

---

## Archiv: Prüfung Vorlage v2 → v3

Legende: 🔴 Widerspruch/Lücke mit Risiko · 🟡 Unklarheit · 🟢 Verbesserung
„Umgesetzt“ = im Code gelöst · „Annahme“ = meine Auslegung, bitte bestätigen · „Offen“ = Entscheidung nötig

## 1. Gefundene Schwachstellen

| # | Stelle | Problem | Status |
|---|--------|---------|--------|
| 1 🔴 | que_1 | Frage ist doppelt („legitim **oder** Rückfragen nötig?“). „Ja“ kann beides heißen, die Logik behandelt Ja aber als „legitim“. | ✅ Gelöst in v2_neu: „Anfrage legitim? (y/n)“ |
| 2 🔴 | que_2 | „teilweise“ steht in der Frage (→ Ja) **und** im Nein-Text („nicht oder nur teilweise zuständig“). Teilzuständigkeit landet je nach Lesart in beiden Ästen. | ✅ Gelöst in v2_neu: Nein = sofortiger Abbruch „… des UKS ist nicht zuständig.“ |
| 3 🔴 | que_1, sub_que_2 | Abbruch passiert **vor** que_3 → es entsteht kein Abschlussbericht. Abgelehnte Anfragen sind damit nicht dokumentiert. | ✅ Entscheidung Nutzer: bleibt so (kein Bericht bei Abbruch) |
| 4 🔴 | que_3 | Browser können **nicht** in einen eingetippten Pfad schreiben. | Umgesetzt: Ordnerwahl per Dialog (Chrome/Edge) oder Download (Firefox/Safari). Pfad wird nur im Bericht dokumentiert. |
| 5 🔴 | que_5 ↔ que_6 | Text sagt bei „gemischt“: „tree_1 und tree_2“, die Tabelle definiert aber **tree_3**. | ✅ Umgesetzt: tree_3 (eine Tabelle, 2 Spalten) |
| 6 🔴 | que_6 (tree_3) | „gemischt“ freigeschaltet schon mit **1** Haken, z. B. nur „entlassen“. Dann ist „gemischt“ fachlich nicht abgebildet. | ✅ Umgesetzt: bei „gemischt“ mind. 1 System **je Spalte**. Alte Regel per `strengGemischt: false` abschaltbar. |
| 7 🔴 | que_9 | „Export nicht ausgeführt → trotzdem fortfahren“ führt direkt zu „Ticket schließen“. Ein Ticket ohne Export zu schließen widerspricht dem Zweck. | ✅ Umgesetzt: que_9 hat **kein** „Trotzdem“. Bei Nein: Hinweis „Export zuerst ausführen“, bleibt in que_9. |
| 8 🟡 | que_7/8/9 | „Trotzdem fortfahren“ ohne Begründung. Im Bericht ist nicht erkennbar, **warum**. | Umgesetzt: Bericht markiert „TROTZDEM FORTGEFAHREN“. ✅ Entscheidung Nutzer: keine Begründung nötig |
| 9 🟡 | que_7/8/9 n→n, que_10 n | „in que_x bleiben“ / „zurück zu que_10“ = Schleife ohne Ausstieg (z. B. Ticket kann nicht geschlossen werden). | Offen – Vorschlag: Button „Pausieren/Zwischenstand speichern“ |
| 10 🟡 | que_4 | Datumsregeln fehlen: Format, echtes Datum, Von ≤ Bis, halb ausgefüllte Zeilen, doppelte Fallnummern. | Umgesetzt: alle geprüft; leere Zeilen werden ignoriert |
| 11 🟡 | que_4 | Fallnummer-Format unbekannt (Länge, nur Ziffern?). | Annahme: beliebiger Text, nicht leer |
| 12 🟡 | que_4 ↔ que_5 | Fallstatus ist bei mehreren Fällen/Zeiträumen pro **Anfrage**, nicht pro Fall. Bei „gemischt“ ist unklar, welcher Fall welchen Status hat. | Offen |
| 13 🟡 | que_6 | Kein Fragetext, keine Erklärung der Kürzel (MV5, MV6, NICE, U). | Annahme: „Welche Dokumentationssysteme sind betroffen?“ |
| 14 🟡 | que_8 | Kategorienliste ist „tba“. | ✅ Umgesetzt: 7 generische Pflegeprozess-Kategorien + „Sonstige“ (`KONFIG.kategorien`) |
| 15 🟡 | Allgemein | Keine Rückwärts-Navigation definiert. Fehlklick bei que_1 = sofortiger Abbruch. | Umgesetzt: Variante A „Antwort korrigieren“, Variante B jederzeit editierbar |
| 16 🟡 | Allgemein | Bericht-Inhalt nur teilweise definiert (que_4–6 „dokumentieren“). | Annahme: alle Antworten + Zeitstempel + Status |
| 17 🟢 | Bericht | Kein Bearbeiter-Name im Bericht. | Offen – Vorschlag: Feld „Bearbeitet von“ in que_3 |
| 18 🟢 | que_3 | Ordnerpfad nach „Erledigt“ nicht mehr änderbar (sonst stimmt Bericht ≠ Ablageort). | Umgesetzt (schreibgeschützt) |
| 19 🟢 | Datenschutz | Fallnummern = personenbezogene Gesundheitsdaten (⚠ nicht verifiziert, bitte mit DSB klären). | Umgesetzt: **keine** Speicherung im Browser (kein localStorage). Nachteil: Neuladen = Daten weg (Warnung beim Schließen). |
| 20 🟢 | CI | SALK-Grün auf Weiß hat nur 2,2:1 Kontrast (WCAG verlangt 4,5:1). | Umgesetzt: Grün nur für Flächen/Rahmen, nie als Text |

## 2. Noch offene Empfehlungen
1. **Ausstieg aus Schleifen** (#9), z. B. „Pausieren“, wenn das Ticket nicht geschlossen werden kann.
2. **Bearbeiter-Name im Bericht** (#17).
3. **Links (Explorer, Ticket-System)** werden vom Nutzer nachgereicht.

## 3. Browser-Einschränkung Dateiablage (verifiziert)
- **Chrome / Edge:** File System Access API (`showDirectoryPicker`). Nutzer wählt den Ordner einmal; die Seite legt `Abschlussbericht.txt` an und aktualisiert sie nach jeder Änderung. Funktioniert über `https://` und lokal per `file://` (lokal: ⚠ nicht in jeder Unternehmens-Konfiguration geprüft, Gruppenrichtlinien können die API sperren).
- **Firefox / Safari:** API nicht vorhanden → Download in den Download-Ordner, Nutzer verschiebt die Datei selbst.
- Netzlaufwerke (`\\server\…`): im Ordnerdialog wählbar, sofern im Explorer verbunden (⚠ nicht getestet).
