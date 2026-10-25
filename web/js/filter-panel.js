// Filter controls (sidebar on desktop, drawer / bottom sheet on smaller screens), active-filter chips and count.
(() => {
  "use strict";
  const Imm = window.Imm;
  const { $, $$, state, OBJ, esc, collator } = Imm;

  function numOr(v, fallback) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function build() {
    $("#top-seg").innerHTML = [["", "Any"], ...[...Imm.TOP].reverse()].map(([id, label]) =>
      `<button type="button" data-top="${id}" aria-pressed="false">${esc(label)}</button>`).join("");
    $("#preset-groups").innerHTML = Imm.PRESET_GROUPS.map((g) => {
      const n = g.subs.reduce((s, sub) => s + sub.items.length, 0);
      return `<details class="acc" data-group="${esc(g.title)}">
        <summary><span>${esc(g.title)}</span><span class="acc-dot" aria-hidden="true"></span><span class="acc-n">${n}</span>${Imm.icon("chevron-down", "acc-chev")}</summary>
        <div class="acc-body">${g.subs.map((s) => `
          ${s.label ? `<p class="sub-label">${esc(s.label)}</p>` : ""}
          <div class="chips">${s.items.map(([id, label]) => `<button type="button" class="chip" data-preset="${id}" aria-pressed="false">${esc(label)}</button>`).join("")}</div>`).join("")}
        </div>
      </details>`;
    }).join("");
    $("#catalog").innerHTML = `<option value="">None</option>` + Imm.D.catalogs.map((c) =>
      `<option value="${esc(c)}">${esc(Imm.catalogLabel(c))}</option>`).join("");
    $("#special").innerHTML = `<option value="">None</option>` + Imm.SPECIAL.map(([l]) => `<option>${esc(l)}</option>`).join("");
    const cons = [...new Set(OBJ.map((o) => o.con).filter(Boolean))].sort(collator.compare);
    $("#con").innerHTML = `<option value="">All</option>` + cons.map((c) => `<option>${esc(c)}</option>`).join("");
    $("#mine").innerHTML = Imm.MINE.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("");
  }

  function sync() {
    const f = state.f;
    $$("[data-top]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.top === f.top)));
    $$("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(f.sel?.kind === "preset" && f.sel.id === b.dataset.preset)));
    const group = f.sel?.kind === "preset" ? Imm.PRESETS.get(f.sel.id)?.group : null;
    $$("details.acc").forEach((d) => {
      const active = d.dataset.group === group;
      d.classList.toggle("has-active", active);
      if (active) d.open = true;
    });
    $("#catalog").value = f.sel?.kind === "catalog" ? f.sel.id : "";
    $("#special").value = f.sel?.kind === "special" ? f.sel.id : "";
    $("#con").value = f.con;
    $("#mine").value = f.mine;
    if (document.activeElement !== $("#search")) $("#search").value = f.search;
    const setNum = (id, v) => { if (document.activeElement !== $(id)) $(id).value = v ?? ""; };
    setNum("#dec-min", f.decMin); setNum("#dec-max", f.decMax);
    setNum("#size-min", f.sizeMin); setNum("#size-max", f.sizeMax);
    setNum("#min-alt", f.minAlt);

    // Count, chips and badge.
    const n = Imm.view.length;
    $("#count").innerHTML = `<strong>${n.toLocaleString()}</strong> <span class="muted">of ${Imm.N.toLocaleString()}</span>`;
    $("#show-count").textContent = `${n.toLocaleString()} object${n === 1 ? "" : "s"}`;
    const active = Imm.activeFilters();
    $("#active-chips").innerHTML = active.map((a, k) =>
      `<button type="button" class="chip removable" data-clear="${k}" title="Remove this filter">${esc(a.label)}${Imm.icon("x", "sm")}</button>`).join("") +
      (active.length > 1 ? `<button type="button" class="chip ghost" data-clear="all">Clear all</button>` : "");
    $("#active-chips").hidden = !active.length;
    const badge = active.filter((a) => a.key !== "search").length;
    $("#filter-badge").textContent = badge;
    $("#filter-badge").hidden = !badge;
  }

  // ---------- drawer / sheet (below the desktop breakpoint) ----------
  let lastFocus = null;
  Imm.openFilters = () => {
    if (Imm.isDesktop()) { $("#filters-body").focus?.(); return; }
    lastFocus = document.activeElement;
    document.body.classList.add("filters-open");
    $("#btn-filters").setAttribute("aria-expanded", "true");
    $("#filters").setAttribute("aria-modal", "true");
    $("#filters").setAttribute("role", "dialog");
    setTimeout(() => $("#filters .filters-head button")?.focus(), 50);
  };
  Imm.closeFilters = () => {
    if (!document.body.classList.contains("filters-open")) return;
    document.body.classList.remove("filters-open");
    $("#btn-filters").setAttribute("aria-expanded", "false");
    $("#filters").removeAttribute("aria-modal");
    $("#filters").removeAttribute("role");
    lastFocus?.focus?.();
  };

  Imm.initFilterPanel = () => {
    build();
    Imm.on("refresh", sync);

    let searchTimer;
    $("#search").addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.f.search = e.target.value;
        Imm.go?.("catalog", { onlyIfAway: true });
        Imm.refresh();
      }, 120);
    });
    $("#search").addEventListener("keydown", (e) => {
      if (e.key === "Escape" && e.target.value) { e.target.value = ""; state.f.search = ""; Imm.refresh(); }
    });

    $("#top-seg").addEventListener("click", (e) => {
      const b = e.target.closest("[data-top]");
      if (!b) return;
      state.f.top = b.dataset.top;
      Imm.refresh();
    });
    $("#preset-groups").addEventListener("click", (e) => {
      const b = e.target.closest("[data-preset]");
      if (b) Imm.select({ kind: "preset", id: b.dataset.preset });
    });
    $("#catalog").addEventListener("change", (e) => Imm.select(e.target.value ? { kind: "catalog", id: e.target.value } : null));
    $("#special").addEventListener("change", (e) => Imm.select(e.target.value ? { kind: "special", id: e.target.value } : null));
    $("#con").addEventListener("change", (e) => { state.f.con = e.target.value; Imm.refresh(); });
    $("#mine").addEventListener("change", (e) => { state.f.mine = e.target.value; Imm.refresh(); });
    const onRange = () => {
      const f = state.f;
      f.decMin = numOr($("#dec-min").value, Imm.DEC_RANGE[0]);
      f.decMax = numOr($("#dec-max").value, Imm.DEC_RANGE[1]);
      f.sizeMin = numOr($("#size-min").value, Imm.SIZE_RANGE[0]);
      f.sizeMax = numOr($("#size-max").value, Imm.SIZE_RANGE[1]);
      f.minAlt = $("#min-alt").value === "" ? null : numOr($("#min-alt").value, null);
      Imm.refresh();
    };
    ["#dec-min", "#dec-max", "#size-min", "#size-max", "#min-alt"].forEach((id) => $(id).addEventListener("change", onRange));
    $("#btn-clear").addEventListener("click", () => Imm.clearFilters(false));
    $("#btn-clear-keep").addEventListener("click", () => Imm.clearFilters(true));
    $("#empty-clear").addEventListener("click", () => Imm.clearFilters(false));

    $("#active-chips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-clear]");
      if (!b) return;
      if (b.dataset.clear === "all") return Imm.clearFilters(false);
      Imm.activeFilters()[Number(b.dataset.clear)]?.clear();
      Imm.refresh();
    });

    $("#btn-filters").addEventListener("click", Imm.openFilters);
    $$("[data-close-filters]").forEach((el) => el.addEventListener("click", Imm.closeFilters));
    $("#filters").addEventListener("keydown", (e) => { if (e.key === "Escape") Imm.closeFilters(); });
  };
})();
