// App state, saved settings and the user's own priority / status / notes ("my data").
(() => {
  "use strict";
  const Imm = window.Imm;
  const { store, D, OBJ, STATUS } = Imm;

  Imm.defaultFilters = (keepRanges) => {
    const base = { search: "", top: "", sel: null, con: "", mine: "", minAlt: null };
    return keepRanges ? base : Object.assign(base, {
      decMin: Imm.DEC_RANGE[0], decMax: Imm.DEC_RANGE[1], sizeMin: Imm.SIZE_RANGE[0], sizeMax: Imm.SIZE_RANGE[1],
    });
  };

  const saved = store.get("settings", {});
  Imm.firstVisit = !Number.isFinite(saved.lat);
  Imm.state = {
    time: new Date(),
    live: saved.live ?? true,
    lat: Number.isFinite(saved.lat) ? saved.lat : Imm.DEFAULT_LAT,
    lon: Number.isFinite(saved.lon) ? saved.lon : Imm.DEFAULT_LON,
    tz: saved.tz ?? "auto",
    theme: saved.theme ?? "auto",
    hidden: saved.hidden ?? Imm.DEFAULT_HIDDEN,
    sort: saved.sort ?? { key: "name", dir: 1 },
    f: Object.assign(Imm.defaultFilters(), saved.f || {}),
    view: saved.view ?? "table", // desktop list layout: "table" | "cards"
  };

  Imm.saveSettings = () => {
    const { lat, lon, tz, theme, hidden, sort, f, live, view } = Imm.state;
    store.set("settings", { lat, lon, tz, theme, hidden, sort, f, live, view });
  };

  // ---------- my data: { [objectId]: { p: 1|2|3, s: "p"|"i"|"f", n: "notes" } } ----------
  const my = store.get("my", {});
  Imm.my = my;

  // Carry saved entries over to objects renamed since the previous edition.
  Imm.migrateIds = (entries) => {
    let moved = 0;
    for (const [from, to] of Object.entries(D.renamed || {})) {
      if (entries[from] && !entries[to]) { entries[to] = entries[from]; moved++; }
      delete entries[from];
    }
    return moved;
  };
  if (Imm.migrateIds(my)) store.set("my", my);

  Imm.myOf = (o) => my[o.id] || {};

  // Keeps only valid, non-empty fields; returns null for an empty entry.
  function clean(v) {
    const out = {};
    if ([1, 2, 3].includes(v.p)) out.p = v.p;
    if (STATUS[v.s]) out.s = v.s;
    if (typeof v.n === "string" && v.n.trim()) out.n = v.n;
    return Object.keys(out).length ? out : null;
  }

  Imm.setMy = (id, entry) => {
    const v = clean(entry);
    if (v) my[id] = v;
    else delete my[id];
    store.set("my", my);
    Imm.emit("my", id);
  };

  Imm.exportMy = () => {
    const blob = new Blob([JSON.stringify({ app: "imm-compendium", version: 1, my }, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `imm-compendium-my-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return Object.keys(my).length;
  };

  // Merges a previously exported file; returns the number of objects imported.
  Imm.importMy = async (file) => {
    const data = JSON.parse(await file.text());
    const incoming = Object.assign({}, data.my || data);
    Imm.migrateIds(incoming);
    let n = 0;
    for (const [id, v] of Object.entries(incoming)) {
      if (!Imm.INDEX.has(id) || !v || typeof v !== "object") continue;
      const c = clean(v);
      if (c) my[id] = c;
      else delete my[id];
      n++;
    }
    store.set("my", my);
    Imm.emit("my", null);
    return n;
  };

  // Counts per My-status filter value, for the My list page.
  Imm.myCounts = () => {
    const c = { any: 0, 1: 0, 2: 0, 3: 0, p: 0, i: 0, f: 0 };
    for (const o of OBJ) {
      const m = my[o.id];
      if (!m) continue;
      c.any++;
      if (m.p) c[m.p]++;
      if (m.s) c[m.s]++;
    }
    return c;
  };
})();
