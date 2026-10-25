// Workbook-derived definitions: filter buttons, dropdowns, catalogue labels and colour scales.
// When a new edition of the Compendium adds a button, dropdown entry or catalogue, this is the
// file to update; everything else reads these tables.
(() => {
  "use strict";
  const Imm = window.Imm;

  // Workbook defaults (Main!I3:K4, V4:V5, X4:X5) — the author's observatory in Onalaska, TX.
  Imm.DEFAULT_LAT = 31.784167;
  Imm.DEFAULT_LON = -95.093333;
  Imm.DEC_RANGE = [-90, 90];
  Imm.SIZE_RANGE = [0, 2400];
  Imm.PAGE = 150;
  Imm.DEFAULT_HIDDEN = ["diam", "altId", "nearby", "sb", "incl", "transitDate"];

  // ---------- filter buttons (one per workbook macro, Sheet1.*_Click) ----------
  // Each item is [id, label, where]; `where` is a list of [field, pattern | [patterns…]]
  // conditions with Excel AutoFilter semantics (see filters.js).
  const GAL = ["type", "Gal"], PN = ["sub", "PN"];
  Imm.PRESET_GROUPS = [
    { title: "Galaxies", subs: [
      { label: "Types", items: [
        ["gal", "All Gal", [["type", "*Gal*"]]],
        ["spiral", "Spiral", [["sub", "Spiral"]]],
        ["ellip", "Ellip.", [["sub", "Ellip"]]],
        ["lent", "Lent.", [["sub", "Lent"]]],
        ["floc", "Floc.", [["sub", "Floc"]]],
        ["barred", "Barred", [["cls", "*z*"]]],
        ["faceon", "Face-On", [GAL, ["cls", "*f*"]]],
        ["grand", "Grand", [GAL, ["cls", "*g*"]]],
        ["vvrow", "VV Row", [GAL, ["cls", "*k*"]]],
        ["edgeon", "Edge-On", [GAL, ["cls", "*d*"]]],
        ["superthin", "Superthin", [GAL, ["cls", "*t*"]]],
      ] },
      { label: "Multiples & interactions", items: [
        ["clusters", "Clusters", [["sub", "Cluster"]]],
        ["groups", "Groups", [["sub", "Group"]]],
        ["chains", "Chains", [["sub", "Chain"]]],
        ["pairs", "Pairs", [["sub", "Pair"]]],
        ["trios", "Trios", [["sub", "Trio"]]],
        ["triplets", "Triplets", [["feat", "*t*"]]],
        ["mergers", "Mergers", [["feat", "*q*"]]],
        ["lgbridge", "Lg Bridge", [["sub", "Merger"], ["cls", ["I", "I/*"]]]],
        ["shbridge", "Sh Bridge", [["sub", "Merger"], ["cls", ["II", "II/*"]]]],
        ["collisional", "Collisional", [["sub", "Coll"]]],
        ["umbrella", "Umbrella", [["feat", "*f*"]]],
      ] },
      { label: "Rings", items: [
        ["polar", "Polar", [["sub", "Polar"]]],
        ["concentric", "Concentric", [GAL, ["cls", "*m*"]]],
        ["nuclear", "Nuclear", [GAL, ["cls", "*n*"]]],
        ["inner", "Inner", [GAL, ["cls", "*r*"]]],
        ["outer", "Outer", [GAL, ["cls", "*o*"]]],
      ] },
      { label: "Star streams", items: [
        ["loops", "Loops", [GAL, ["cls", "*j*"]]],
        ["shells", "Shells", [GAL, ["cls", "*h*"]]],
        ["tail", "Tail", [GAL, ["cls", "*u*"]]],
        ["dualtails", "Dual Tails", [GAL, ["cls", "*x*"]]],
        ["superlong", "Superlong", [GAL, ["cls", "*y*"]]],
      ] },
    ] },
    { title: "Nebulae", subs: [
      { label: "", items: [
        ["neb", "All Neb", [["type", "Neb"]]],
        ["sho", "SHO", [["cls", "*SHO*"]]],
        ["hii", "HII", [["cls", "HII"]]],
        ["dark", "Dark", [["sub", "Dark"]]],
        ["snr", "SNR", [["sub", "SNR"]]],
        ["wr", "WR", [["cls", "*WR*"]]],
        ["refl", "Reflection", [["sub", "Refl"]]],
        ["molcld", "Mol Cloud", [["sub", "Mol Cld"]]],
      ] },
    ] },
    { title: "Planetary nebulae", subs: [
      { label: "", items: [
        ["pn", "All PN", [PN]],
        ["ancient", "Ancient", [PN, ["cls", "*a*"]]],
        ["spherical", "Spherical", [PN, ["cls", "*s*"]]],
        // The workbook wires this button to the galaxy Elliptical macro; EllipticalPN_Click is the intended one.
        ["ellippn", "Elliptical", [PN, ["cls", "*e*"]]],
        ["bipolar", "Bipolar", [PN, ["cls", "*b*"]]],
        ["multipolar", "Multipolar", [PN, ["cls", "*m*"]]],
        ["peculiar", "Peculiar", [PN, ["cls", "*p*"]]],
        ["ppn", "PPN", [["sub", "PPN"]]],
      ] },
    ] },
    { title: "Stars", subs: [
      { label: "", items: [
        ["gc", "Glob Clus", [["sub", "GC"]]],
        ["oc", "Open Clus", [["sub", "OC"]]],
        ["asterisms", "Asterisms", [["type", "Stars"], ["cls", "*a*"]]],
        ["yso", "YSO", [["sub", "YSO"]]],
      ] },
    ] },
  ];
  Imm.PRESETS = new Map();
  for (const g of Imm.PRESET_GROUPS) for (const s of g.subs) for (const [id, label, where] of s.items) Imm.PRESETS.set(id, { label, where, group: g.title });

  // Main!AG3 dropdown labels ('Hidden Calculations'!A44:A70). Faint Giants (6th edition) has
  // a column but no dropdown entry in the workbook; the app lists it anyway.
  // Catalogues not listed here still appear (from data.js) under their column header name.
  const CATALOG_LABEL = {
    NGC: "NGC", IC: "IC", H400: "H400", Messier: "Messier", Caldwell: "Caldwell", Arp: "GAL: Arp",
    Hickson: "GAL: Hickson", "Abell Gal": "GAL: Abell Clusters", UGC: "GAL: UGC", PGC: "GAL: PGC",
    "Abell PN": "PN: Abell", Griffiths: "PN: Griffiths", Kohoutek: "PN: Kohoutek", Minkowski: "PN: Minkowski",
    Barnard: "NEB: Barnard", Gum: "NEB: Gum", LBN: "NEB: LBN", LDN: "NEB: LDN", RCW: "NEB: RCW", Sh2: "NEB: Sh2",
    SNR: "NEB: SNR", vdB: "NEB: vdB", "Hidden Treasures": "Hidden Treasures", "Secret Deep": "Secret Deep",
    "Orphaned Beauties": "Orph. Beauties", "Small Packages": "Small Packages", "Faint Giants": "Faint Giants",
  };
  Imm.catalogLabel = (c) => CATALOG_LABEL[c] || c;

  // Search shorthands per catalogue ("m31", "sh2-155", "b 33").
  Imm.CAT_PREFIX = { Messier: "m", Caldwell: "c", NGC: "ngc", IC: "ic", Barnard: "b", Sh2: "sh2-", Arp: "arp", vdB: "vdb", Hickson: "hcg", LBN: "lbn", LDN: "ldn", UGC: "ugc", PGC: "pgc", Gum: "gum", RCW: "rcw" };

  // Main!BF3 dropdown ('Hidden Calculations'!A74:A106) and the macros it triggers.
  Imm.SPECIAL = [
    ["GAL: Type-Antennae", [["feat", "*a*"]]],
    ["GAL: Type-Hexagon Shape", [["feat", "*h*"]]],
    ["GAL: Type-Integral Sign", [["feat", "*i*"]]],
    ["GAL: Type-M51", [["feat", "*m*"]]],
    ["GAL: Type-Myst. Disturbed", [["feat", "*y*"]]],
    ["GAL: Type-Sombrero", [["feat", "*s*"]]],
    ["GAL: Type-Voorwerp", [["feat", "*v*"]]],
    ["GAL: Dist->1 billion ly", [["feat", "*>*"]]],
    ["GAL: Dist-Lensing", [["feat", "*^*"]]],
    ["GAL: Dist-Local Group", [["feat", "*<*"]]],
    ["GAL: Arms-Many", [["feat", "*n*"]]],
    ["GAL: Arms-Open", [["feat", "*e*"]]],
    ["GAL: Arms-Three", [["feat", "*u*"]]],
    ["GAL: Small-BCD", [["sub", "BCD"]]],
    ["GAL: Small-Dwarf", [["sub", "Dwarf"]]],
    ["GAL: Small-Magellanic", [["sub", "Mag"]]],
    ["GAL: Core-Barlens", [GAL, ["cls", "*l*"]]],
    ["GAL: Core-X Shape", [GAL, ["cls", "*p*"]]],
    ["NEB: Bok Globules", [["feat", "*k*"]]],
    ["NEB: Cometary", [["feat", "*c*"]]],
    ["NEB: Stromgren", [["feat", "*p*"]]],
    ["NEB: Variable", [["feat", "*z*"]]],
    ["PN: Ansae & Jets", [["feat", "*j*"]]],
    ["PN: Bright Torus", [["feat", "*d*"]]],
    ["PN: Hexagon Shape", [["feat", "*x*"]]],
    ["PN: Owl-Type", [["feat", "*o*"]]],
    ["PN: Thin Rim", [["feat", "*r*"]]],
    ["PN: Weinberger", [["feat", "*w*"]]],
    ["STARS: Herbig-Haro", [["sub", "HH"]]],
    ["STARS: Nova", [["sub", "Nova"]]],
    ["STARS: Sag. Dwarf Objects", [["feat", "*g*"]]],
    ["STARS: Star Cloud", [["sub", "Star Cld"]]],
  ];

  // Top Targets (Main!J rating): [id, label, minimum rating]; they stack on every other filter.
  Imm.TOP = [["2", "Top 2%", 5], ["10", "Top 10%", 4], ["25", "Top 25%", 3]];

  // Workbook colour scales: altitude 20/50/80 red→yellow→green, moon index 15/50/85 red→white→blue.
  Imm.ALT_SCALE = [[20, [248, 105, 107]], [50, [255, 235, 132]], [80, [99, 190, 123]]];
  Imm.MOON_SCALE = [[15, [248, 105, 107]], [50, [252, 252, 255]], [85, [90, 138, 198]]];

  // My priority / status (workbook "My" columns).
  Imm.STATUS = { p: "Planned", i: "In progress", f: "Finished" };
  Imm.MINE = [["", "Any"], ["any", "Flagged (any)"], ["1", "Priority 1"], ["2", "Priority 2"], ["3", "Priority 3"],
    ["p", "Planned"], ["i", "In progress"], ["f", "Finished"], ["notf", "Not finished"]];

  // Sort menu: [key, direction, label].
  Imm.SORTS = [["name", 1, "Name A–Z"], ["transit", 1, "Transit (next first)"], ["alt0", -1, "Altitude now"],
    ["alt1", -1, "Altitude +2 h"], ["alt2", -1, "Altitude +4 h"], ["alt3", -1, "Altitude +6 h"],
    ["maxAlt", -1, "Max altitude"], ["rating", -1, "Rating"], ["moonIdx", -1, "Moon index"],
    ["size", -1, "Size (largest)"], ["vmag", 1, "Magnitude (brightest)"], ["catnum", 1, "Catalog number"]];
})();
