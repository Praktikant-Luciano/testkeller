"""Erzeugt das Prozessdiagramm der Dokucheckliste PDok (Stand v3_nutzer, ohne CD-Blau) als
SVG (Ansicht/Druck) und .drawio (bearbeitbar in draw.io; Export nach Visio .vsdx dort möglich).
Eine Quelle (Knoten + Kanten mit festen Koordinaten) -> beide Formate sind identisch.
Ausführen: python3 tools/entscheidungsbaum.py
"""
from html import escape
from pathlib import Path

CI = dict(gruen='#94BF05', grau='#6E6F70', hellgrau='#B0B2B4', beige='#F6F4EA', weiss='#FFFFFF')
FONT = 'Arial'
OUT = Path(__file__).resolve().parent.parent / 'docs' / 'entscheidungsbaum'

# Stil je Knotentyp: (Füllung, Rahmen, Textfarbe, fett)
# Ohne CD-Blau (Vorgabe Nutzer): nur SALK-Grün, Textgrau, Hellgrau, Beige.
# Grün nur als Fläche/Rahmen (als Text auf Weiß zu kontrastarm).
STIL = {
    'start':    (CI['weiss'], CI['gruen'], CI['grau'],  True),
    'ende':     (CI['weiss'], CI['gruen'], CI['grau'],  True),
    'abbruch':  (CI['grau'],  CI['grau'],  CI['weiss'], True),
    'schritt':  (CI['weiss'], CI['grau'],  CI['grau'],  False),
    'frage':    (CI['beige'], CI['grau'],  CI['grau'],  True),
    'hinweis':  (CI['beige'], CI['hellgrau'], CI['grau'], False),
    'dokument': (CI['weiss'], CI['gruen'], CI['grau'],  False),
    'titel':    ('none',      'none',      CI['grau'],  False),
}
RAHMEN = {'start': 4, 'ende': 4}

N = {}   # id -> dict
E = []   # Kanten

def knoten(id, art, cx, cy, w, h, text):
    N[id] = dict(id=id, art=art, cx=cx, cy=cy, w=w, h=h, text=text)

def port(id, p):
    n = N[id]; x, y, w, h = n['cx'], n['cy'], n['w'], n['h']
    return {'o': (x, y - h/2), 'u': (x, y + h/2), 'l': (x - w/2, y), 'r': (x + w/2, y)}[p]

def kante(a, pa, b, pb, punkte=(), label=None, gestrichelt=False, label_xy=None):
    E.append(dict(a=a, pa=pa, b=b, pb=pb, punkte=list(punkte), label=label, gestrichelt=gestrichelt, label_xy=label_xy))

# ---------------- Layout ----------------
M, R, L, RR = 420, 820, 140, 1000   # Spalten: Mitte, rechts, links, Rücklauf
PW, PH, DW, DH = 320, 64, 260, 120

knoten('titel', 'titel', 575, 30, 900, 40, 'Prozessdiagramm Dokucheckliste PDok · Stand v3 (Nutzer)')
knoten('start', 'start', M, 100, 300, 50, 'Anfrage zur Aushebung der PDok')
knoten('q1', 'frage', M, 220, DW, DH, 'Frage 1\nAnfrage berechtigt?')
knoten('a1', 'abbruch', R, 220, 280, 70, 'ABBRUCH\nAuf Antwort des Anfragegebers warten\nbzw. Rücksprache mit DL/MM')
knoten('q2', 'frage', M, 390, DW, DH, 'Frage 2\nBetrifft die Anfrage ganz oder\nteilweise UKS Campus LKH\nund/oder Campus CDK?')
knoten('a2', 'abbruch', R, 390, 280, 60, 'ABBRUCH\nStabstelle Pflegeinformatik\ndes UKS ist nicht zuständig')
knoten('p3a', 'schritt', M, 545, PW, 90, 'Frage 3 · Ordner anlegen unter\nG:\\…\\Beschwerden_Schadensfälle\\test cp\nOrdnername eingeben (Pflicht)\n→ „Erledigt“')
knoten('doc', 'dokument', R, 545, 240, 64, 'Abschlussbericht.txt\nwird im Ordner angelegt')
knoten('p3b', 'schritt', M, 670, PW, 76, 'Ticket als Störung anlegen und\nsich selbst zuweisen\nTicketnummer eingeben (Pflicht) → „Erledigt“')
knoten('p4a', 'schritt', M, 790, PW, 76, 'Frage 4 · Teilschritt 1\nAnzahl Fälle (0–5) und Zeiträume (0–5)\n→ „Weiter“ (gesperrt, wenn beide 0)')
knoten('p4b', 'schritt', M, 910, PW, 76, 'Teilschritt 2 · je Fall: Fallnummer\nje Zeitraum: TT.MM.JJJJ – TT.MM.JJJJ\n→ „Fertig und weiter“')
knoten('p4c', 'schritt', M, 1030, PW, 76, 'Teilschritt 3 · Was darf ausgehoben werden?\n○ Komplette PDok des Umfangs\n○ Teile des Umfangs (+ Freitext)')
knoten('d5', 'frage', M, 1170, DW, 100, 'Frage 5\nWelcher Fallstatus?')
y = 1300
knoten('t1', 'schritt', L, y, 220, 56, 'tree_1\nSpalte „entlassen“')
knoten('t2', 'schritt', M, y, 220, 56, 'tree_2\nSpalte „aktuell“')
knoten('t3', 'schritt', 700, y, 240, 56, 'tree_3 (tree_1 + tree_2)\n„entlassen“ + „aktuell“')
knoten('p6', 'schritt', M, 1430, 340, 76, 'Frage 6 · Dokumentationssysteme wählen\nMV5 · MV6 · NICE · U · Papier (Mehrfachwahl)\nmind. 1 Haken → „Weiter“')

def trotzdem_block(nr, cy, text, rueck_y):
    knoten(f'q{nr}', 'frage', M, cy, DW, DH, text)
    knoten(f't{nr}', 'frage', R, cy, 220, 100, 'Trotzdem\nfortfahren?')
    kante(f'q{nr}', 'r', f't{nr}', 'l', label='Nein')
    kante(f't{nr}', 'r', f'q{nr}', 'o', [(RR, cy), (RR, rueck_y), (M, rueck_y)], label=f'Nein · in Frage {nr} bleiben', label_xy=(RR + 8, cy - 40))

trotzdem_block(7, 1600, 'Frage 7\nAlle relevanten Dokumente\nidentifiziert (inkl.\nHandsuche Hydmedia)?', 1500)
trotzdem_block(8, 1810, 'Frage 8\nAlle Dokumente einer\nKategorie zugeordnet?', 1710)
knoten('kat', 'hinweis', L - 10, 1810, 200, 70, 'Kategorien:\nPflegeanamnese\n… (weitere tba)')
trotzdem_block(9, 2020, 'Frage 9\nExport über Livelink\nopentext an Anfragegeber\nausgeführt?', 1920)
knoten('q10', 'frage', M, 2230, DW, DH, 'Frage 10\nWurde das Ticket\ngeschlossen?')
knoten('h10', 'hinweis', R, 2230, 220, 50, 'Hinweis: „Ticket schliessen!“')
knoten('ende', 'ende', M, 2380, 320, 56, 'ENDE · Abschlussbericht.txt\nanzeigen und speichern')

# Legende
lx, ly = 30, 1990
knoten('leg', 'titel', lx + 105, ly, 210, 24, 'Legende')
knoten('lg1', 'start', lx + 105, ly + 40, 200, 30, 'Start / Ende')
knoten('lg2', 'abbruch', lx + 105, ly + 80, 200, 30, 'Abbruch')
knoten('lg3', 'schritt', lx + 105, ly + 120, 200, 30, 'Arbeitsschritt / Eingabe')
knoten('lg4', 'frage', lx + 105, ly + 175, 200, 60, 'Entscheidung (Ja/Nein)')
knoten('lg5', 'hinweis', lx + 105, ly + 235, 200, 30, 'Hinweis')
knoten('lg6', 'dokument', lx + 105, ly + 280, 200, 36, 'Datei')

# ---------------- Kanten ----------------
kante('start', 'u', 'q1', 'o')
kante('q1', 'r', 'a1', 'l', label='Nein')
kante('q1', 'u', 'q2', 'o', label='Ja')
kante('q2', 'r', 'a2', 'l', label='Nein')
kante('q2', 'u', 'p3a', 'o', label='Ja')
kante('p3a', 'r', 'doc', 'l', gestrichelt=True)
kante('p3a', 'u', 'p3b', 'o')
kante('p3b', 'u', 'p4a', 'o')
kante('p4a', 'u', 'p4b', 'o')
kante('p4b', 'u', 'p4c', 'o')
kante('p4c', 'u', 'd5', 'o')
kante('d5', 'l', 't1', 'o', [(L, 1170)], label='entlassen')
kante('d5', 'u', 't2', 'o', label='aktuell')
kante('d5', 'r', 't3', 'o', [(700, 1170)], label='gemischt')
kante('t1', 'u', 'p6', 'o', [(L, 1365), (M, 1365)])
kante('t2', 'u', 'p6', 'o')
kante('t3', 'u', 'p6', 'o', [(700, 1365), (M, 1365)])
kante('p6', 'u', 'q7', 'o')
kante('q7', 'u', 'q8', 'o', label='Ja')
kante('t7', 'u', 'q8', 'o', [(R, 1690), (M, 1690)], label='Ja')
kante('q8', 'u', 'q9', 'o', label='Ja')
kante('t8', 'u', 'q9', 'o', [(R, 1900), (M, 1900)], label='Ja')
kante('q9', 'u', 'q10', 'o', label='Ja')
kante('t9', 'u', 'q10', 'o', [(R, 2110), (M, 2110)], label='Ja')
kante('q10', 'r', 'h10', 'l', label='Nein')
kante('h10', 'r', 'q10', 'o', [(RR, 2230), (RR, 2140), (M, 2140)], label='zurück zu Frage 10', label_xy=(RR + 8, 2190))
kante('q10', 'u', 'ende', 'o', label='Ja')

BREITE, HOEHE = 1150, 2450

# ---------------- SVG ----------------
def svg_text(n):
    zeilen = n['text'].split('\n'); fs = 12 if n['art'] != 'titel' else (20 if n['id'] == 'titel' else 14)
    lh = fs * 1.25; y0 = n['cy'] - (len(zeilen) - 1) * lh / 2
    fill, _, farbe, fett = STIL[n['art']]
    out = []
    for i, z in enumerate(zeilen):
        w = 'bold' if (fett and i == 0) or n['id'] == 'leg' else 'normal'
        if n['art'] == 'hinweis' and n['id'] == 'kat': w = 'bold' if i == 0 else 'normal'
        out.append(f'<text x="{n["cx"]}" y="{y0 + i*lh:.1f}" font-size="{fs}" font-weight="{w}" fill="{farbe}" text-anchor="middle" dominant-baseline="central">{escape(z)}</text>')
    return '\n'.join(out)

def svg_form(n):
    fill, stroke, _, _ = STIL[n['art']]; x, y, w, h = n['cx'] - n['w']/2, n['cy'] - n['h']/2, n['w'], n['h']
    a = n['art']
    if a == 'titel': return ''
    if a in ('start', 'ende', 'abbruch'): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{min(h/2, 28)}" fill="{fill}" stroke="{stroke}" stroke-width="{RAHMEN.get(a, 2)}"/>'
    if a == 'frage':
        cx, cy = n['cx'], n['cy']
        return f'<polygon points="{cx},{y} {x+w},{cy} {cx},{y+h} {x},{cy}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
    if a == 'dokument':
        return (f'<path d="M{x},{y} H{x+w} V{y+h-8} Q{x+w*0.75},{y+h-22} {x+w/2},{y+h-8} T{x},{y+h-8} Z" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
    dash = ' stroke-dasharray="5 3"' if a == 'hinweis' else ''
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="2"{dash}/>'

def kantenpunkte(e):
    return [port(e['a'], e['pa'])] + e['punkte'] + [port(e['b'], e['pb'])]

def svg_kante(e):
    p = kantenpunkte(e)
    d = 'M' + ' L'.join(f'{x},{y}' for x, y in p)
    dash = ' stroke-dasharray="6 4"' if e['gestrichelt'] else ''
    s = f'<path d="{d}" fill="none" stroke="{CI["grau"]}" stroke-width="1.6" marker-end="url(#pfeil)"{dash}/>'
    if e['label']:
        (x1, y1), (x2, y2) = p[0], p[1]
        if e['label_xy']:
            lx, ly, anchor = *e['label_xy'], 'start'
        elif y1 == y2:  # waagrecht -> Label über dem Segment
            lx, ly, anchor = x1 + (12 if x2 > x1 else -12), y1 - 8, 'start' if x2 > x1 else 'end'
        else:         # senkrecht -> Label rechts neben dem Segment
            lx, ly, anchor = x1 + 8, y1 + (16 if y2 > y1 else -16), 'start'
        s += (f'<text x="{lx}" y="{ly}" font-size="11" font-weight="bold" fill="{CI["grau"]}" text-anchor="{anchor}" '
              f'paint-order="stroke" stroke="{CI["weiss"]}" stroke-width="4">{escape(e["label"])}</text>')
    return s

svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{BREITE}" height="{HOEHE}" viewBox="0 0 {BREITE} {HOEHE}" font-family="{FONT}, sans-serif">',
       f'<defs><marker id="pfeil" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{CI["grau"]}"/></marker></defs>',
       f'<rect width="100%" height="100%" fill="{CI["weiss"]}"/>',
       f'<rect x="0" y="0" width="{BREITE}" height="6" fill="{CI["gruen"]}"/>']
svg += [svg_kante(e) for e in E]
for n in N.values(): svg += [svg_form(n), svg_text(n)]
svg.append('</svg>')
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'entscheidungsbaum.svg').write_text('\n'.join(svg), encoding='utf-8')

# ---------------- draw.io ----------------
def dio_stil(n):
    fill, stroke, farbe, fett = STIL[n['art']]
    basis = f'whiteSpace=wrap;html=1;fontFamily={FONT};fontSize=12;fontColor={farbe};fillColor={fill};strokeColor={stroke};strokeWidth={RAHMEN.get(n["art"], 2)};'
    a = n['art']
    if a == 'titel': return f'text;html=1;align=center;verticalAlign=middle;fontFamily={FONT};fontSize={20 if n["id"]=="titel" else 14};fontColor={farbe};fontStyle={1 if n["id"]=="leg" else 0};'
    if a in ('start', 'ende', 'abbruch'): return 'rounded=1;arcSize=50;' + basis
    if a == 'frage': return 'rhombus;' + basis
    if a == 'dokument': return 'shape=document;boundedLbl=1;size=0.2;' + basis
    if a == 'hinweis': return 'rounded=1;arcSize=8;dashed=1;' + basis
    return 'rounded=1;arcSize=8;' + basis

def dio_text(n):
    zeilen = [escape(z) for z in n['text'].split('\n')]
    if STIL[n['art']][3] or n['id'] == 'kat': zeilen[0] = f'<b>{zeilen[0]}</b>'
    return escape('<br>'.join(zeilen))

PORT = {'o': (0.5, 0), 'u': (0.5, 1), 'l': (0, 0.5), 'r': (1, 0.5)}
zellen = []
for n in N.values():
    zellen.append(f'<mxCell id="{n["id"]}" value="{dio_text(n)}" style="{dio_stil(n)}" vertex="1" parent="1">'
                  f'<mxGeometry x="{n["cx"]-n["w"]/2}" y="{n["cy"]-n["h"]/2}" width="{n["w"]}" height="{n["h"]}" as="geometry"/></mxCell>')
for i, e in enumerate(E):
    ex, ey = PORT[e['pa']]; nx, ny = PORT[e['pb']]
    st = (f'endArrow=block;endFill=1;html=1;rounded=0;strokeColor={CI["grau"]};strokeWidth=1.6;fontFamily={FONT};fontSize=11;'
          f'fontColor={CI["grau"]};fontStyle=1;labelBackgroundColor={CI["weiss"]};'
          f'exitX={ex};exitY={ey};exitDx=0;exitDy=0;entryX={nx};entryY={ny};entryDx=0;entryDy=0;' + ('dashed=1;' if e['gestrichelt'] else ''))
    pts = ''.join(f'<mxPoint x="{x}" y="{y}"/>' for x, y in e['punkte'])
    zellen.append(f'<mxCell id="e{i}" value="{escape(e["label"] or "")}" style="{st}" edge="1" parent="1" source="{e["a"]}" target="{e["b"]}">'
                  f'<mxGeometry x="-0.6" relative="1" as="geometry">' + (f'<Array as="points">{pts}</Array>' if pts else '') + '</mxGeometry></mxCell>')
dio = (f'<mxfile host="tools/entscheidungsbaum.py"><diagram id="pdok" name="Dokucheckliste PDok v3">'
       f'<mxGraphModel dx="{BREITE}" dy="{HOEHE}" grid="1" gridSize="10" page="1" pageWidth="{BREITE}" pageHeight="{HOEHE}" background="#FFFFFF">'
       f'<root><mxCell id="0"/><mxCell id="1" parent="0"/>' + ''.join(zellen) + '</root></mxGraphModel></diagram></mxfile>')
(OUT / 'entscheidungsbaum.drawio').write_text(dio, encoding='utf-8')
print('ok', len(N), 'Knoten,', len(E), 'Kanten')
