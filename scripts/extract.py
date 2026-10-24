#!/usr/bin/env python3
"""Extract the Imm Deep Sky Compendium workbook into static web-app data.

Usage:
  python3 -I scripts/extract.py "Imm Deep Sky Compendium - 2026 - rev6b.xlsm" \
      [--previous "Imm Deep Sky Compendium - 2023 - rev4g.xlsm"]

Writes:
  web/data.js          window.IMM_DATA = {...}  (objects + reference text)
  web/thumbs/*.jpg     per-object mouseover thumbnails
  scripts/fixture.json the workbook's cached calculated values, for verify.mjs

--previous maps objects that were renamed since an older edition (matched by position)
so the app can carry users' saved priority / status / notes over to the new names.

Main-sheet columns A..AH are fixed across editions; everything from the catalogue
block onward is located from the header rows (6-9), since editions insert columns.
Standard library only: the .xlsm is a zip of XML parts.
"""
import html
import json
import math
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R_ID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
FIRST_ROW = 10
CATALOG_START = "AI"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")

# Main!row-8 catalogue header -> label used in the app. "Abell" appears twice:
# first under Galaxy (clusters), then under Planetary Nebulae.
CATALOG_HEADERS = {
    "NGC": "NGC", "IC": "IC", "H400": "H400", "Messier": "Messier", "Caldwell": "Caldwell",
    "Arp": "Arp", "Hickson": "Hickson", "Abell": ("Abell Gal", "Abell PN"), "UGC": "UGC",
    "PGC": "PGC", "Griff.": "Griffiths", "Kohou.": "Kohoutek", "Mink.": "Minkowski",
    "Barn.": "Barnard", "Gum": "Gum", "LBN": "LBN", "LDN": "LDN", "RCW": "RCW", "Sh2": "Sh2",
    "SNR": "SNR", "vdB": "vdB", "HT": "Hidden Treasures", "SD": "Secret Deep",
    "OB": "Orphaned Beauties", "SP": "Small Packages", "FG": "Faint Giants",
}


def col_index(col):
    n = 0
    for ch in col:
        n = n * 26 + ord(ch) - 64
    return n


def col_letter(n):
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def col_of(ref):
    return re.match(r"[A-Z]+", ref).group(0)


def row_of(ref):
    return int(re.search(r"\d+", ref).group(0))


def num(x):
    """Convert a cell string to int/float when it is numeric, else stripped str/None."""
    if x is None:
        return None
    s = x.strip()
    if s == "":
        return None
    try:
        f = float(s)
    except ValueError:
        return s
    return int(f) if f.is_integer() and "e" not in s.lower() else f


def text(x):
    if x is None:
        return None
    s = x.strip()
    return s or None


class Book:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        self.ss = [
            "".join(t.text or "" for t in si.iter(M + "t"))
            for si in ET.fromstring(self.z.read("xl/sharedStrings.xml")).iter(M + "si")
        ]

    def read(self, name):
        return self.z.read(name)

    def rels(self, part):
        """Relationship id -> target for a part's .rels file."""
        d, f = os.path.split(part)
        try:
            data = self.read(f"{d}/_rels/{f}.rels").decode()
        except KeyError:
            return {}
        return {
            m.group(1): html.unescape(m.group(2))
            for m in re.finditer(r'<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"', data)
        }

    def sheet(self, n):
        """Return ({ref: value}, {ref: formula}, {ref: url}, {ref: comment})."""
        part = f"xl/worksheets/sheet{n}.xml"
        root = ET.fromstring(self.read(part))
        values, formulas = {}, {}
        for c in root.iter(M + "c"):
            ref = c.get("r")
            v, f = c.find(M + "v"), c.find(M + "f")
            if v is not None:
                values[ref] = self.ss[int(v.text)] if c.get("t") == "s" else v.text
            if f is not None and f.text:
                formulas[ref] = f.text
        rels = self.rels(part)
        links = {}
        for h in root.iter(M + "hyperlink"):
            rid = h.get(R_ID)
            if rid in rels:
                links[h.get("ref")] = rels[rid]
        comments = {}
        for target in rels.values():
            if "comments" in target:
                croot = ET.fromstring(self.read("xl/" + target.replace("../", "")))
                for cm in croot.iter(M + "comment"):
                    t = "".join(x.text or "" for x in cm.iter(M + "t"))
                    t = re.sub(r"^\s*Gary Imm:?\s*", "", t).strip()
                    if t:
                        comments[cm.get("ref")] = t
        return values, formulas, links, comments


def drawing_text(book, part):
    """Text boxes of a drawing part as [{title, body, link}] in document order."""
    data = book.read(part).decode()
    rels = book.rels(part)
    blocks = []
    for sp in re.findall(r"<xdr:sp\b.*?</xdr:sp>", data, re.S):
        paras = [
            html.unescape("".join(re.findall(r"<a:t>([^<]*)</a:t>", p)))
            for p in re.findall(r"<a:p>.*?</a:p>", sp, re.S)
        ]
        while paras and not paras[0].strip():
            paras.pop(0)
        if not paras:
            continue
        link = None
        m = re.search(r'<a:hlinkClick [^>]*r:id="([^"]+)"', sp)
        if m and m.group(1) in rels:
            link = rels[m.group(1)]
        body = "\n".join(paras[1:]).strip()
        blocks.append({"title": paras[0].strip(), "body": body, "link": link})
    return blocks


def thumbnails(book):
    """Main-sheet row -> media path, from column-A comment fill images."""
    vml = book.read("xl/drawings/vmlDrawing1.vml").decode()
    rels = book.rels("xl/drawings/vmlDrawing1.vml")
    out = {}
    for shape in vml.split("<v:shape ")[1:]:
        rid = re.search(r'o:relid="([^"]+)"', shape)
        row = re.search(r"<x:Row>(\d+)</x:Row>", shape)
        col = re.search(r"<x:Column>(\d+)</x:Column>", shape)
        if rid and row and col and col.group(1) == "0":
            out[int(row.group(1)) + 1] = "xl/" + rels[rid.group(1)].replace("../", "")
    return out


def decode_ra(packed):
    """Main!M formula: hhmmss packed integer -> degrees."""
    s = f"{int(packed):06d}"
    return 15 * (int(s[0:2]) + int(s[2:4]) / 60 + int(s[4:6]) / 3600)


def decode_dec(packed):
    """Main!O formula: ±ddmmss packed integer -> degrees (negatives keep the sign char)."""
    v = int(packed)
    if v > 0:
        s = f"{v:06d}"
        return int(s[0:2]) + int(s[2:4]) / 60 + int(s[4:6]) / 3600
    # Excel TEXT(-24051,"000000") -> "-024051"; formula reads MID(2,2), MID(4,2), RIGHT(2)
    s = "-" + f"{-v:06d}"
    return -(int(s[1:3]) + int(s[3:5]) / 60 + int(s[5:7]) / 3600)


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def excel_md(serial):
    """Excel date serial -> 'MM-DD' (year is irrelevant for a yearly transit date)."""
    import datetime
    d = datetime.date(1899, 12, 30) + datetime.timedelta(days=int(float(serial)))
    return d.strftime("%m-%d")


def layout(book, values, formulas, comments):
    """Locate the Main-sheet columns that move between editions."""
    wb = book.read("xl/workbook.xml").decode()
    m = re.search(r'_xlnm\._FilterDatabase"[^>]*>Main!\$A\$\d+:\$([A-Z]+)\$(\d+)<', wb)
    last_col, last_row = m.group(1), int(m.group(2))
    lay = {"last_row": last_row, "catalogs": [], "key": None, "fov": None, "feat": None,
           "time_sort": None, "azimuth": None, "prev_row": None, "unknown": []}
    abell = iter(CATALOG_HEADERS["Abell"])
    in_catalogs = True
    for i in range(col_index(CATALOG_START), col_index(last_col) + 1):
        col = col_letter(i)
        h7, h8, h9 = (text(values.get(f"{col}{r}")) or "" for r in (7, 8, 9))
        f10 = formulas.get(f"{col}{FIRST_ROW}", "")
        if h9 == "KEY":
            lay["key"] = col
        elif h9 == "FOV":
            lay["fov"] = col
        elif h8 == "Add. Filters":
            lay["feat"] = col
        elif f10.startswith("MOD((50000+AD"):
            lay["time_sort"] = col
        elif f10.startswith("altaz(") and f10.replace(" ", "").endswith(",2)"):
            lay["azimuth"] = col
        elif h8.startswith("Sort to"):
            lay["prev_row"] = col
        elif in_catalogs and not f10 and h8:
            label = next(abell) if h8 == "Abell" else CATALOG_HEADERS.get(h8)
            if not label:
                # New catalogue: name it from the header note ("Faint Giants Catalogue\n...").
                note = (comments.get(f"{col}8") or h8).splitlines()[0]
                label = re.sub(r"\s+Catalog(ue)?$", "", note).strip() or h8
                lay["unknown"].append(f"{col}8 '{h8}' -> '{label}'")
            lay["catalogs"].append((col, label))
        if lay["key"] or h7 == "SIMBAD &":
            in_catalogs = False
    missing = [k for k in ("key", "fov", "feat", "time_sort") if not lay[k]]
    if missing:
        sys.exit(f"Could not find Main-sheet columns for {missing}; check the header rows.")
    return lay


def edition_info(path, title):
    m = re.search(r"(\d{4})\s*-\s*(\d+\w*)\s+Edition", title or "")
    rev = re.search(r"rev\s*(\w+)", os.path.basename(path), re.I)
    return {
        "title": title,
        "year": m.group(1) if m else None,
        "edition": f"{m.group(2)} Edition" if m else None,
        "revision": rev.group(1) if rev else None,
        "source": os.path.basename(path),
    }


def read_objects(book, lay, values, links, thumbs=None):
    """Main-sheet rows -> object dicts. Writes thumbnails when `thumbs` is given."""
    def v(col, r):
        return values.get(f"{col}{r}") if col else None

    objects, seen, mismatches = [], {}, []
    for r in range(FIRST_ROW, lay["last_row"] + 1):
        name = text(v("A", r))
        if not name:
            continue
        oid = slug(name)
        seen[oid] = seen.get(oid, 0) + 1
        if seen[oid] > 1:
            oid = f"{oid}-{seen[oid]}"
        ra, dec = decode_ra(v("L", r)), decode_dec(v("N", r))
        # A few sheet rows have hard-typed or mis-referenced M/O cells; L/N are authoritative.
        if abs(ra - float(v("M", r))) > 1e-6 or abs(dec - float(v("O", r))) > 1e-6:
            mismatches.append(name)

        o = {
            "id": oid,
            "name": name,
            "astrobin": links.get(f"A{r}"),
            "type": text(v("D", r)),
            "sub": text(v("E", r)),
            "cls": text(v("F", r)),
            "size": num(v("G", r)),
            "dist": num(v("H", r)),
            "diam": num(v("I", r)),
            "rating": num(v("J", r)),
            "notes": text(v("K", r)),
            "raHms": f"{int(v('L', r)):06d}",
            "decDms": v("N", r).strip(),
            "ra": round(ra, 6),
            "dec": round(dec, 6),
            "con": text(v("P", r)),
            "nick": text(v("Q", r)),
            "altId": text(v("R", r)),
            "nearby": text(v("S", r)),
            "vmag": num(v("T", r)),
            "sb": num(v("U", r)),
            "incl": num(v("V", r)),
            "transitDate": excel_md(v("AE", r)) if v("AE", r) else None,
            "key": text(v(lay["key"], r)),
            "fov": round(float(v(lay["fov"], r)), 3) if v(lay["fov"], r) else 0.2,
            "feat": text(v(lay["feat"], r)),
        }
        cats = {label: num(v(col, r)) for col, label in lay["catalogs"] if num(v(col, r)) is not None}
        if cats:
            o["cats"] = cats
        if thumbs is not None and r in thumbs:
            fname = f"thumbs/{oid}.jpg"
            with open(os.path.join(WEB, fname), "wb") as fh:
                fh.write(book.read(thumbs[r]))
            o["thumb"] = fname
        objects.append({k: val for k, val in o.items() if val is not None})
    return objects, mismatches


def separation(a, b):
    ra1, d1, ra2, d2 = (math.radians(x) for x in (a["ra"], a["dec"], b["ra"], b["dec"]))
    c = math.sin(d1) * math.sin(d2) + math.cos(d1) * math.cos(d2) * math.cos(ra1 - ra2)
    return math.degrees(math.acos(max(-1.0, min(1.0, c))))


def renamed_since(previous_path, objects):
    """Old id -> new id for objects whose name changed since the previous edition.

    Objects are matched by position (within 0.1°), nearest first, among old objects whose
    id is gone and new objects whose id is new. The workbook's own "Sort to" column is not
    used: it is offset in places (Excel sorts "LDN 564" after "LDN 1622").
    """
    book = Book(previous_path)
    values, formulas, links, comments = book.sheet(1)
    old, _ = read_objects(book, layout(book, values, formulas, comments), values, links)
    new_ids = {o["id"] for o in objects}
    old_ids = {o["id"] for o in old}
    gone = [o for o in old if o["id"] not in new_ids]
    fresh = [o for o in objects if o["id"] not in old_ids]
    pairs = sorted((separation(a, b), a["id"], b["id"]) for a in gone for b in fresh)
    out, used_old, used_new = {}, set(), set()
    for sep, a, b in pairs:
        if sep <= 0.1 and a not in used_old and b not in used_new:
            out[a] = b
            used_old.add(a)
            used_new.add(b)
    # Corrected positions: fall back to a shared designation (name or catalogue number),
    # e.g. "NGC 2422" -> "NGC 2423" (both H400 103), "vdB 156abc" -> "vdB 156".
    def designations(o):
        compact = lambda s: re.sub(r"(?<![0-9.])0+(?=\d)", "", re.sub(r"[\s\-_]+", "", str(s).lower()))
        return {compact(o["name"])} | {compact(f"{k}{n}") for k, n in o.get("cats", {}).items()}
    for a in gone:
        if a["id"] in used_old:
            continue
        hits = [b for b in fresh if b["id"] not in used_new and designations(a) & designations(b)]
        if len(hits) == 1:
            out[a["id"]] = hits[0]["id"]
            used_old.add(a["id"])
            used_new.add(hits[0]["id"])
    unmatched = [o["id"] for o in gone if o["id"] not in out]
    return out, unmatched


def main(path, previous=None):
    book = Book(path)
    values, formulas, links, comments = book.sheet(1)
    lay = layout(book, values, formulas, comments)
    os.makedirs(os.path.join(WEB, "thumbs"), exist_ok=True)
    for old in os.listdir(os.path.join(WEB, "thumbs")):
        if old.endswith(".jpg"):
            os.remove(os.path.join(WEB, "thumbs", old))
    objects, mismatches = read_objects(book, lay, values, links, thumbnails(book))
    catalogs = lay["catalogs"]

    def v(col, r):
        return values.get(f"{col}{r}")

    # Header-cell help text (rows 1-8 comments) keyed by cell.
    help_text = {ref: t for ref, t in comments.items() if row_of(ref) <= 8}

    def sheet_table(n):
        vals, _, lnks, cmts = book.sheet(n)
        rows = {}
        for ref, val in vals.items():
            if val is None or not str(val).strip():
                continue
            rows.setdefault(row_of(ref), {})[col_of(ref)] = {
                k: x for k, x in {"t": str(val).strip(), "link": lnks.get(ref),
                                  "note": cmts.get(ref)}.items() if x
            }
        return [{"r": r, "cells": rows[r]} for r in sorted(rows)]

    renamed, unmatched = renamed_since(previous, objects) if previous else ({}, [])
    data = {
        "edition": edition_info(path, text(v("A", 1))),
        "objects": objects,
        "catalogs": [label for _, label in catalogs],
        # Catalogue header cells link to the author's Astrobin collection for that catalogue.
        "catalogLinks": {label: links[ref] for col, label in catalogs
                         for ref in links if col_of(ref) == col and 6 <= row_of(ref) < FIRST_ROW},
        # Help text for the moved columns, keyed by role rather than cell.
        "help": help_text,
        "helpMoved": {k: comments.get(f"{lay[k]}7") or comments.get(f"{lay[k]}8")
                      for k in ("azimuth",) if lay[k]},
        "quickStart": comments.get("K1"),
        "userGuide": drawing_text(book, "xl/drawings/drawing2.xml"),
        "classGuide": drawing_text(book, "xl/drawings/drawing3.xml"),
        "types": sheet_table(3),
        "definitions": sheet_table(4),
        "references": sheet_table(5),
        "coordFixes": mismatches,
        "renamed": renamed,
    }
    with open(os.path.join(WEB, "data.js"), "w", encoding="utf-8") as fh:
        fh.write("// Generated by scripts/extract.py from the Imm Deep Sky Compendium. Do not edit.\n")
        fh.write("window.IMM_DATA = ")
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")

    # Cached workbook values for verifying the JS sky calculations.
    f = lambda ref: float(values[ref])
    sample = []
    for r in range(FIRST_ROW, lay["last_row"] + 1, 50):
        o = {
            # The coordinates the sheet itself computed with (Main!M/O), not the corrected ones.
            "name": v("A", r), "ra": f(f"M{r}"), "dec": f(f"O{r}"),
            "alt": [f(f"{c}{r}") for c in ("Z", "AA", "AB", "AC")],
            "transitFrac": f(f"AD{r}") % 1, "maxAlt": f(f"AF{r}"), "moonSep": f(f"AG{r}"),
            "moonIndex": f(f"AH{r}"), "timeSort": f(f"{lay['time_sort']}{r}"),
        }
        if lay["azimuth"]:
            o["azimuth"] = f(f"{lay['azimuth']}{r}")
        sample.append(o)
    fixture = {
        "source": os.path.basename(path),
        "serial": f("B3"), "lat": f("AJ3"), "lon": f("AJ4"),
        "gmtOffset": f("G4"), "dst": values["G3"].strip().upper() == "Y",
        "sun": {"sunset": f("M2") % 1, "nautSet": f("M3") % 1, "nautRise": f("M4") % 1,
                "sunrise": f("M5") % 1},
        "moon": {"rise": f("O2") % 1, "set": f("O3") % 1, "age": f("O4"), "illum": f("O5"),
                 "ra": f("Q5"), "dec": f("S5")},
        "sunStatus": [int(f(f"{c}8")) for c in ("Z", "AA", "AB", "AC")],
        "objects": sample,
    }
    with open(os.path.join(ROOT, "scripts", "fixture.json"), "w") as fh:
        json.dump(fixture, fh, indent=1)

    print(f"{data['edition']['title']} (rev {data['edition']['revision']})")
    print(f"objects: {len(objects)}  thumbnails: {sum('thumb' in o for o in objects)}  "
          f"astrobin links: {sum('astrobin' in o for o in objects)}  last row: {lay['last_row']}")
    print(f"catalogues ({len(catalogs)}): {', '.join(f'{c}={l}' for c, l in catalogs)}")
    print(f"key={lay['key']} fov={lay['fov']} feat={lay['feat']} timeSort={lay['time_sort']} "
          f"azimuth={lay['azimuth']} prevRow={lay['prev_row']}")
    if lay["unknown"]:
        print(f"NEW catalogue headers (labelled from their notes): {lay['unknown']}")
    print(f"rows whose sheet RA/Dec columns disagree with their hms/dms source: {mismatches}")
    if previous:
        print(f"renamed since {os.path.basename(previous)}: {renamed}")
        print(f"previous ids with no match (removed): {unmatched}")
    size = os.path.getsize(os.path.join(WEB, "data.js"))
    print(f"data.js: {size / 1e6:.2f} MB")


if __name__ == "__main__":
    args = sys.argv[1:]
    prev = None
    if "--previous" in args:
        i = args.index("--previous")
        prev = args[i + 1] if i + 1 < len(args) else sys.exit(__doc__)
        del args[i:i + 2]
    if len(args) != 1:
        sys.exit(__doc__)
    main(args[0], prev)
