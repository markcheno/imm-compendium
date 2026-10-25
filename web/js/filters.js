// Filtering, search and sorting of the catalogue (produces Imm.view, a list of object indexes).
(() => {
  "use strict";
  const Imm = window.Imm;
  const { OBJ, N, collator, state } = Imm;

  // ---------- Excel AutoFilter semantics ----------
  // Criteria are case-insensitive; "*" is a wildcard, otherwise the whole cell must match.
  const critCache = new Map();
  function matcher(pattern) {
    if (!critCache.has(pattern)) {
      const p = pattern.toLowerCase();
      let fn;
      if (p.includes("*")) {
        const re = new RegExp("^" + p.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$", "s");
        fn = (v) => v != null && re.test(String(v).toLowerCase());
      } else {
        fn = (v) => v != null && String(v).toLowerCase() === p;
      }
      critCache.set(pattern, fn);
    }
    return critCache.get(pattern);
  }
  // A filter is a list of [field, pattern | [patterns…]] conditions that must all hold.
  function matches(o, where) {
    return where.every(([field, pat]) => {
      const pats = Array.isArray(pat) ? pat : [pat];
      return pats.some((p) => matcher(p)(o[field]));
    });
  }

  // ---------- search index ----------
  const unpad = (s) => s.replace(/(^|[^0-9.])0+(?=\d)/g, "$1");
  const HAY = OBJ.map((o) => {
    const parts = [o.name, o.nick, o.altId, o.nearby, o.key, o.con, o.notes, o.sub, o.cls];
    for (const [cat, n] of Object.entries(o.cats || {})) {
      parts.push(`${cat} ${n}`);
      if (Imm.CAT_PREFIX[cat]) parts.push(`${Imm.CAT_PREFIX[cat]}${n} ${Imm.CAT_PREFIX[cat]} ${n}`);
    }
    return unpad(parts.filter(Boolean).join(" | ").toLowerCase());
  });
  // Compact designations ("m31", "ngc891", "sh2155") so an exact id search ranks first.
  const compact = (s) => unpad(String(s).toLowerCase()).replace(/[\s\-_]+/g, "");
  const IDS = OBJ.map((o) => {
    const ids = new Set([o.name, o.altId, o.key, o.nick].filter(Boolean).map(compact));
    for (const [cat, n] of Object.entries(o.cats || {})) ids.add(compact(`${Imm.CAT_PREFIX[cat] || cat}${n}`));
    return ids;
  });

  // ---------- selection (preset button, catalogue or special filter: one at a time) ----------
  Imm.catSel = () => (state.f.sel?.kind === "catalog" ? state.f.sel.id : null);
  function selWhere() {
    const sel = state.f.sel;
    if (!sel) return null;
    if (sel.kind === "preset") return Imm.PRESETS.get(sel.id)?.where;
    if (sel.kind === "special") return Imm.SPECIAL.find(([l]) => l === sel.id)?.[1];
    return null;
  }
  Imm.selLabel = () => {
    const sel = state.f.sel;
    if (!sel) return "";
    if (sel.kind === "preset") return Imm.PRESETS.get(sel.id)?.label ?? "";
    if (sel.kind === "catalog") return Imm.catalogLabel(sel.id);
    return sel.id;
  };

  // Every category button / dropdown clears the others first (Sheet1.ResetFilterXDS); Top Targets stack.
  Imm.select = (sel) => {
    const same = sel && state.f.sel && sel.kind === state.f.sel.kind && sel.id === state.f.sel.id;
    state.f.sel = same ? null : sel;
    if (state.f.sel?.kind === "catalog") state.sort = { key: "catnum", dir: 1 };
    else if (state.sort.key === "catnum") state.sort = { key: "name", dir: 1 };
    Imm.refresh();
  };

  Imm.clearFilters = (keepRanges) => {
    if (keepRanges) {
      const { decMin, decMax, sizeMin, sizeMax } = state.f;
      state.f = Object.assign(Imm.defaultFilters(true), { decMin, decMax, sizeMin, sizeMax });
      state.sort = { key: "name", dir: 1 };
    } else {
      state.f = Imm.defaultFilters();
      if (state.sort.key === "catnum") state.sort = { key: "name", dir: 1 };
    }
    Imm.refresh();
  };

  // Active filters as removable chips: [{ key, label, clear() }]. clear() only mutates state.
  Imm.activeFilters = () => {
    const f = state.f, out = [];
    const [D0, D1] = Imm.DEC_RANGE, [S0, S1] = Imm.SIZE_RANGE;
    if (f.sel) out.push({ key: "sel", label: Imm.selLabel(), clear: () => {
      f.sel = null;
      if (state.sort.key === "catnum") state.sort = { key: "name", dir: 1 };
    } });
    const top = Imm.TOP.find(([id]) => id === f.top);
    if (top) out.push({ key: "top", label: top[1], clear: () => { f.top = ""; } });
    if (f.con) out.push({ key: "con", label: `In ${f.con}`, clear: () => { f.con = ""; } });
    if (f.mine) out.push({ key: "mine", label: `My: ${Imm.MINE.find(([v]) => v === f.mine)?.[1] ?? f.mine}`, clear: () => { f.mine = ""; } });
    if (f.decMin !== D0 || f.decMax !== D1) out.push({ key: "dec", label: `Dec ${f.decMin}…${f.decMax}°`, clear: () => { f.decMin = D0; f.decMax = D1; } });
    if (f.sizeMin !== S0 || f.sizeMax !== S1) out.push({ key: "size", label: `Size ${f.sizeMin}…${f.sizeMax}′`, clear: () => { f.sizeMin = S0; f.sizeMax = S1; } });
    if (f.minAlt != null) out.push({ key: "alt", label: `Alt ≥ ${f.minAlt}° in 6 h`, clear: () => { f.minAlt = null; } });
    if (f.search) out.push({ key: "search", label: `“${f.search}”`, clear: () => { f.search = ""; } });
    return out;
  };

  // ---------- sorting ----------
  function sortValue(i, key) {
    const o = OBJ[i], calc = Imm.calc;
    switch (key) {
      case "name": return o.name;
      case "catnum": return Imm.catSel() ? o.cats?.[Imm.catSel()] : null;
      case "type": return `${o.type} ${o.sub}`;
      case "alt0": case "alt1": case "alt2": case "alt3": return calc.alt[Number(key[3])][i];
      case "transit": return calc.untilTransit[i];
      case "maxAlt": case "moonSep": case "moonIdx": case "az": return calc[key][i];
      case "my": { const m = Imm.myOf(o); return m.p ? 10 - m.p : m.s ? 1 : null; }
      default: return o[key];
    }
  }
  function compare(a, b) {
    // Blank cells sort last regardless of direction; text after numbers (e.g. "u" = unknown).
    if (a == null || a === "") return b == null || b === "" ? 0 : 1;
    if (b == null || b === "") return -1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "number") return -1;
    if (typeof b === "number") return 1;
    return collator.compare(a, b);
  }

  // ---------- filtering ----------
  Imm.view = [];
  Imm.applyFilters = () => {
    const f = state.f, calc = Imm.calc;
    const where = selWhere();
    const cat = Imm.catSel();
    const top = Imm.TOP.find(([id]) => id === f.top);
    const q = unpad(f.search.trim().toLowerCase());
    const terms = q.split(/\s+/).filter(Boolean);
    const qId = q ? compact(q) : "";
    const rank = new Map();
    const out = [];
    for (let i = 0; i < N; i++) {
      const o = OBJ[i];
      if (o.dec < f.decMin || o.dec > f.decMax) continue;
      if (typeof o.size === "number" && (o.size < f.sizeMin || o.size > f.sizeMax)) continue;
      if (where && !matches(o, where)) continue;
      if (cat && o.cats?.[cat] == null) continue;
      if (top && !(o.rating >= top[2])) continue;
      if (f.con && o.con !== f.con) continue;
      if (f.mine) {
        const m = Imm.myOf(o);
        if (f.mine === "any" ? !(m.p || m.s || m.n) : f.mine === "notf" ? m.s === "f" : /^\d$/.test(f.mine) ? String(m.p) !== f.mine : m.s !== f.mine) continue;
      }
      if (f.minAlt != null && Math.max(calc.alt[0][i], calc.alt[1][i], calc.alt[2][i], calc.alt[3][i]) < f.minAlt) continue;
      if (q) {
        // 0 = exact designation, 1 = phrase match, 2 = every word somewhere.
        const r = IDS[i].has(qId) ? 0 : HAY[i].includes(q) ? 1 : terms.every((t) => HAY[i].includes(t)) ? 2 : -1;
        if (r < 0) continue;
        rank.set(i, r);
      }
      out.push(i);
    }
    const { key, dir } = state.sort;
    out.sort((a, b) => {
      if (q && rank.get(a) !== rank.get(b)) return rank.get(a) - rank.get(b);
      const va = sortValue(a, key), vb = sortValue(b, key);
      const blankA = va == null || va === "", blankB = vb == null || vb === "";
      if (blankA || blankB) return compare(va, vb);
      return dir * compare(va, vb) || collator.compare(OBJ[a].name, OBJ[b].name);
    });
    Imm.view = out;
  };
})();
