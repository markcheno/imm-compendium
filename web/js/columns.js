// Catalogue columns, colour scales and small per-object renderers shared by the table, cards and detail view.
(() => {
  "use strict";
  const Imm = window.Imm;
  const { D, esc, fmtNum, isMilkyWay, compass, stars, fmtRA, fmtDec, STATUS, MONTH } = Imm;

  // Interpolates a workbook colour scale; returns an inline style.
  Imm.heat = (v, scale) => {
    const lo = scale[0][0], hi = scale[scale.length - 1][0];
    const x = Math.max(lo, Math.min(hi, v));
    let i = 0;
    while (i < scale.length - 2 && x > scale[i + 1][0]) i++;
    const [x0, c0] = scale[i], [x1, c1] = scale[i + 1];
    const t = (x - x0) / (x1 - x0);
    const rgb = c0.map((c, k) => Math.round(c + (c1[k] - c) * t));
    const pos = (x - lo) / (hi - lo);
    if (document.documentElement.dataset.theme === "night") {
      return `background:rgb(${Math.round(40 + 170 * pos)} ${Math.round(8 + 40 * pos)} 6);color:${pos > 0.45 ? "#000" : "#d23a2a"}`;
    }
    return `background:rgb(${rgb.join(" ")} / var(--heat-alpha));color:var(--heat-text)`;
  };
  Imm.altHeat = (v) => Imm.heat(v, Imm.ALT_SCALE);
  Imm.moonHeat = (v) => Imm.heat(v, Imm.MOON_SCALE);

  Imm.SUN_COLORS = ["var(--sun-dark)", "var(--sun-twilight)", "var(--sun-day)"];
  Imm.SUN_LABEL = ["Dark (sun below −12°)", "Twilight", "Daylight"];

  const STATUS_ICON = { p: "○", i: "◐", f: "●" };
  Imm.myBadge = (m) => {
    const out = [];
    if (m.p) out.push(`<span class="pill pri p${m.p}" title="Priority ${m.p}">P${m.p}</span>`);
    if (m.s) out.push(`<span class="pill st" title="${STATUS[m.s]}">${STATUS_ICON[m.s]}<span class="st-text"> ${STATUS[m.s]}</span></span>`);
    if (m.n) out.push(`<span class="pill note" title="${esc(m.n)}">✎</span>`);
    return out.join("");
  };
  // Row / card classes for priority accent and status.
  Imm.myClasses = (m) => [m.p ? "pri-" + m.p : "", m.s ? "st-" + m.s : ""].join(" ").trim();

  Imm.simbadUrl = (o) => `http://simbad.u-strasbg.fr/simbad/sim-id?Ident=${encodeURIComponent(o.key || o.name)}&submit=submit+id`;
  Imm.aladinUrl = (o) => `http://aladin.cds.unistra.fr/AladinLite/?target=${encodeURIComponent(o.key || o.name)}&fov=${o.fov}`;
  Imm.linksHtml = (o, compact) => {
    const a = (href, short, long, title) => compact
      ? `<a href="${esc(href)}" target="_blank" rel="noopener" title="${title}">${short}</a>`
      : `<a href="${esc(href)}" target="_blank" rel="noopener" title="${title}" class="btn">${long}${Imm.icon("external", "sm")}</a>`;
    return [
      o.astrobin ? a(o.astrobin, "AB", "Astrobin", "Gary Imm's full-resolution image on Astrobin") : "",
      a(Imm.simbadUrl(o), "S", "SIMBAD", "SIMBAD technical data"),
      a(Imm.aladinUrl(o), "A", "Aladin", "Aladin sky atlas"),
    ].join(compact ? "" : " ");
  };
  Imm.transitDateText = (o) => (o.transitDate ? `${MONTH[Number(o.transitDate.slice(0, 2)) - 1]} ${Number(o.transitDate.slice(3))}` : "");
  Imm.objHref = (o) => `#/object/${encodeURIComponent(o.id)}`;

  // ---------- table columns ----------
  // help: workbook header-note cell (D.help); fixed: always shown; dynamic: shown with a catalogue selected;
  // dir: first sort direction; alt: index into Astro.ALT_OFFSETS_H.
  const calcOf = () => Imm.calc;
  const myOf = Imm.myOf;
  Imm.COLS = [
    { key: "thumb", label: "", nosort: true, cls: "thumb", fixed: true,
      td: (o) => (o.thumb ? `<img src="${o.thumb}" alt="" loading="lazy" width="44" height="44">` : "") },
    { key: "name", label: "Object", cls: "name sticky", help: "C7", fixed: true,
      td: (o) => `<a class="obj-link" href="${Imm.objHref(o)}">${esc(o.name)}</a>${o.nick ? `<span class="nick">${esc(o.nick)}</span>` : ""}` },
    { key: "catnum", label: "Cat #", num: true, cls: "num", dynamic: true,
      td: (o) => fmtNum(Imm.catSel() ? o.cats?.[Imm.catSel()] : "") },
    { key: "type", label: "Type", help: "D7", cls: "nowrap", td: (o) => `${esc(o.type)} · ${esc(o.sub)}` },
    { key: "cls", label: "Class", help: "F7", cls: "nowrap", td: (o) => esc(o.cls) },
    { key: "size", label: "Size ′", help: "G7", num: true, td: (o) => fmtNum(o.size, 2) },
    { key: "dist", label: "Distance", help: "H7", num: true,
      td: (o) => (o.dist == null ? "" : `<span class="${isMilkyWay(o) ? "milky" : ""}">${fmtNum(o.dist, 1)}</span>`) },
    { key: "diam", label: "Diameter", help: "I7", num: true,
      td: (o) => (o.diam == null ? "" : `<span class="${isMilkyWay(o) ? "milky" : ""}">${fmtNum(o.diam, 1)}</span>`) },
    { key: "rating", label: "Rating", help: "J7", dir: -1, cls: "nowrap", td: (o) => stars(o.rating) },
    { key: "notes", label: "Notes", cls: "notes", nosort: true, td: (o) => `<div>${esc(o.notes)}</div>` },
    { key: "ra", label: "RA", help: "M7", num: true, cls: "nowrap", td: fmtRA },
    { key: "dec", label: "Dec", help: "O7", num: true, cls: "nowrap", td: fmtDec },
    { key: "con", label: "Const.", td: (o) => esc(o.con) },
    { key: "altId", label: "Alt. ID", td: (o) => esc(o.altId) },
    { key: "nearby", label: "Nearby", help: "S7", td: (o) => esc(o.nearby) },
    { key: "vmag", label: "Mag", help: "T7", num: true, td: (o) => fmtNum(o.vmag, 1) },
    { key: "sb", label: "Surf. br.", help: "U7", num: true, td: (o) => fmtNum(o.sb, 1) },
    { key: "incl", label: "Incl. °", help: "V7", num: true, td: (o) => fmtNum(o.incl) },
    ...[0, 1, 2, 3].map((k) => ({
      key: "alt" + k, label: "", num: true, dir: -1, cls: "heat", alt: k,
      td: (o, i) => `${Math.round(calcOf().alt[k][i])}°`, style: (o, i) => Imm.altHeat(calcOf().alt[k][i]),
    })),
    { key: "az", label: "Azimuth", num: true, cls: "nowrap", helpText: D.helpMoved?.azimuth,
      td: (o, i) => `${Math.round(calcOf().az[i]) % 360}° ${compass(calcOf().az[i])}` },
    { key: "transit", label: "Transit", num: true, cls: "nowrap", help: "AD6",
      td: (o, i) => Imm.fmtTime(new Date(calcOf().transit[i])) },
    { key: "maxAlt", label: "Max alt", help: "AF7", num: true, dir: -1, td: (o, i) => `${Math.round(calcOf().maxAlt[i])}°` },
    { key: "moonSep", label: "Moon sep", num: true, dir: -1, td: (o, i) => `${Math.round(calcOf().moonSep[i])}°` },
    { key: "moonIdx", label: "Moon idx", help: "AH7", num: true, dir: -1, cls: "heat",
      td: (o, i) => Math.round(calcOf().moonIdx[i]), style: (o, i) => Imm.moonHeat(calcOf().moonIdx[i]) },
    { key: "transitDate", label: "Midnight transit", help: "AE7", cls: "nowrap", td: Imm.transitDateText },
    { key: "my", label: "My", help: "W7", cls: "nowrap", dir: -1, td: (o) => Imm.myBadge(myOf(o)) },
    { key: "links", label: "Links", nosort: true, cls: "links nowrap", td: (o) => Imm.linksHtml(o, true) },
  ];
  Imm.COL = new Map(Imm.COLS.map((c) => [c.key, c]));
})();
