// The object list: table (desktop) or cards (phones, or by choice), paging, sorting and columns.
(() => {
  "use strict";
  const Imm = window.Imm;
  const { $, $$, state, OBJ, COLS, COL, esc, Astro, HOUR_MS } = Imm;

  let rendered = 0, altTimes = [], mode = null;
  const listMode = () => (Imm.isPhone() ? "cards" : state.view);
  const visibleCols = () => COLS.filter((c) => (c.dynamic ? !!Imm.catSel() : !state.hidden.includes(c.key)));
  const scroller = () => (Imm.isPhone() ? document.scrollingElement : $("#list-wrap"));
  const bodyEl = () => (mode === "table" ? $("#list tbody") : $("#list .cards"));

  // ---------- table ----------
  function renderHead() {
    const hours = Astro.ALT_OFFSETS_H;
    const cells = visibleCols().map((c) => {
      let label = esc(c.label);
      let title = c.helpText || (c.help && Imm.D.help[c.help]) || "";
      if (c.alt != null) {
        const t = new Date(state.time.getTime() + hours[c.alt] * HOUR_MS);
        const st = Imm.sky.sunStatus[c.alt];
        label = `${Imm.fmtTime(t)}<span class="sun" style="background:${Imm.SUN_COLORS[st]}" title="${Imm.SUN_LABEL[st]}"></span>`;
        title = `Altitude at ${Imm.fmtTime(t, true)} (${c.alt ? "+" + hours[c.alt] + " h" : "selected time"}) · sun: ${Imm.SUN_LABEL[st]}`;
      }
      if (c.key === "catnum") label = esc(Imm.catSel());
      const sorted = state.sort.key === c.key ? (state.sort.dir > 0 ? "ascending" : "descending") : null;
      const classes = [c.num ? "num" : "", c.nosort ? "nosort" : "", c.key === "name" ? "sticky" : ""].join(" ").trim();
      return `<th scope="col" data-key="${c.key}" class="${classes}"${sorted ? ` aria-sort="${sorted}"` : ""}${title ? ` title="${esc(title)}"` : ""}>${label}</th>`;
    });
    $("#list thead").innerHTML = `<tr>${cells.join("")}</tr>`;
  }

  function rowHtml(i) {
    const o = OBJ[i];
    const cls = Imm.myClasses(Imm.myOf(o));
    const tds = visibleCols().map((c) => {
      const tdCls = [`c-${c.key}`, c.cls || "", c.num ? "num" : ""].join(" ").trim();
      const style = c.style ? ` style="${c.style(o, i)}"` : "";
      return `<td class="${tdCls}"${style}>${c.td(o, i)}</td>`;
    });
    return `<tr data-i="${i}"${cls ? ` class="${cls}"` : ""}>${tds.join("")}</tr>`;
  }

  // ---------- cards ----------
  function cardHtml(i) {
    const o = OBJ[i], calc = Imm.calc, m = Imm.myOf(o);
    const cls = Imm.myClasses(m);
    const cat = Imm.catSel();
    const alts = [0, 1, 2, 3].map((k) =>
      `<span style="${Imm.altHeat(calc.alt[k][i])}"><small>${altTimes[k]}</small>${Math.round(calc.alt[k][i])}°</span>`).join("");
    return `<article class="card${cls ? " " + cls : ""}" data-i="${i}">
      ${o.thumb ? `<img class="card-thumb" src="${o.thumb}" alt="" loading="lazy" width="72" height="72">` : `<span class="card-thumb"></span>`}
      <div class="card-head">
        <h3><a class="obj-link" href="${Imm.objHref(o)}">${esc(o.name)}</a>${cat && o.cats?.[cat] != null ? `<span class="catnum">#${Imm.fmtNum(o.cats[cat])}</span>` : ""}</h3>
        ${o.nick ? `<p class="nick">${esc(o.nick)}</p>` : ""}
        <p class="card-meta">${esc(o.type)} · ${esc(o.sub)}${o.con ? ` · ${esc(o.con)}` : ""} ${Imm.stars(o.rating)}</p>
      </div>
      <div class="card-alts" aria-label="Altitude now, +2, +4, +6 hours">${alts}</div>
      <div class="card-stats">
        <span><small>Transit</small>${Imm.fmtTime(new Date(calc.transit[i]))}</span>
        <span><small>Max</small>${Math.round(calc.maxAlt[i])}°</span>
        <span class="heat" style="${Imm.moonHeat(calc.moonIdx[i])}"><small>Moon</small>${Math.round(calc.moonIdx[i])}</span>
        ${m.p || m.s || m.n ? `<span class="card-my">${Imm.myBadge(m)}</span>` : ""}
      </div>
      ${o.notes ? `<p class="card-notes">${esc(o.notes)}</p>` : ""}
    </article>`;
  }

  const itemHtml = (i) => (mode === "table" ? rowHtml(i) : cardHtml(i));

  function renderBody(keepCount) {
    const want = listMode();
    if (want !== mode) {
      mode = want;
      $("#list").innerHTML = mode === "table" ? `<table class="catalog"><thead></thead><tbody></tbody></table>` : `<div class="cards"></div>`;
      document.body.dataset.list = mode;
    }
    altTimes = Astro.ALT_OFFSETS_H.map((h) => Imm.fmtTime(new Date(state.time.getTime() + h * HOUR_MS)));
    if (mode === "table") renderHead();
    const target = keepCount ? Math.max(rendered, Imm.PAGE) : Imm.PAGE;
    rendered = Math.min(Imm.view.length, target);
    let html = "";
    for (let k = 0; k < rendered; k++) html += itemHtml(Imm.view[k]);
    bodyEl().innerHTML = html;
    $("#empty").hidden = Imm.view.length > 0;
    $("#list-end").hidden = rendered >= Imm.view.length;
  }
  function renderMore() {
    if (rendered >= Imm.view.length) return;
    const next = Math.min(Imm.view.length, rendered + Imm.PAGE);
    let html = "";
    for (let k = rendered; k < next; k++) html += itemHtml(Imm.view[k]);
    bodyEl().insertAdjacentHTML("beforeend", html);
    rendered = next;
    $("#list-end").hidden = rendered >= Imm.view.length;
  }
  // Re-renders one object's row or card in place (after editing my data).
  Imm.updateItem = (i) => {
    const el = $(`#list [data-i="${i}"]`);
    if (el) el.outerHTML = itemHtml(i);
  };

  function scrollToTop(smooth) {
    const behavior = smooth ? "smooth" : "auto";
    if (Imm.isPhone()) window.scrollTo({ top: 0, behavior });
    else $("#list-wrap").scrollTo({ top: 0, behavior });
  }

  Imm.refresh = (opts = {}) => {
    Imm.applyFilters();
    renderBody(opts.keepCount);
    Imm.emit("refresh");
    Imm.saveSettings();
    if (!opts.keepScroll) scrollToTop(false);
  };
  Imm.rerenderList = () => renderBody(true);

  // ---------- sort menu ----------
  function syncSortSelect() {
    const sel = $("#sort-select");
    const opts = Imm.SORTS.filter(([k]) => k !== "catnum" || Imm.catSel());
    const cur = `${state.sort.key}:${state.sort.dir}`;
    const known = opts.some(([k, d]) => `${k}:${d}` === cur);
    sel.innerHTML = (known ? "" : `<option value="${esc(cur)}">${esc(COL.get(state.sort.key)?.label || "Custom")} ${state.sort.dir > 0 ? "↑" : "↓"}</option>`) +
      opts.map(([k, d, l]) => `<option value="${k}:${d}">${esc(l)}</option>`).join("");
    sel.value = cur;
  }

  Imm.initList = () => {
    Imm.on("refresh", syncSortSelect);
    Imm.on("my", (id) => {
      if (id == null) return Imm.refresh({ keepCount: true, keepScroll: true });
      Imm.updateItem(Imm.INDEX.get(id));
    });

    $("#sort-select").addEventListener("change", (e) => {
      const [key, dir] = e.target.value.split(":");
      state.sort = { key, dir: Number(dir) };
      Imm.refresh();
    });
    $("#list").addEventListener("click", (e) => {
      const th = e.target.closest("th[data-key]");
      if (th) {
        const c = COL.get(th.dataset.key);
        if (!c || c.nosort) return;
        state.sort = state.sort.key === c.key ? { key: c.key, dir: -state.sort.dir } : { key: c.key, dir: c.dir || 1 };
        Imm.refresh();
        return;
      }
      const a = e.target.closest("a");
      // Let modified clicks open the object link in a new tab; other links (SIMBAD etc.) go out as usual.
      if (a && (!a.classList.contains("obj-link") || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)) return;
      const item = e.target.closest("[data-i]");
      if (!item) return;
      e.preventDefault();
      Imm.openDetail(Number(item.dataset.i));
    });

    // View toggle (desktop / tablet).
    const syncView = () => $$("[data-view-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.viewMode === state.view)));
    $$("[data-view-mode]").forEach((b) => b.addEventListener("click", () => {
      state.view = b.dataset.viewMode;
      syncView();
      Imm.saveSettings();
      renderBody(true);
    }));
    syncView();

    // Column chooser.
    $("#col-menu").innerHTML = `<p class="menu-title">Table columns</p>` + COLS.filter((c) => !c.fixed && !c.dynamic).map((c) =>
      `<label class="check"><input type="checkbox" data-col="${c.key}"> ${c.alt != null ? `Altitude +${Astro.ALT_OFFSETS_H[c.alt]} h` : esc(c.label)}</label>`).join("") +
      `<button class="btn sm" id="cols-reset">Reset to default</button>`;
    const syncCols = () => $$("[data-col]").forEach((cb) => { cb.checked = !state.hidden.includes(cb.dataset.col); });
    syncCols();
    $("#col-menu").addEventListener("change", (e) => {
      const cb = e.target.closest("[data-col]");
      if (!cb) return;
      state.hidden = cb.checked ? state.hidden.filter((k) => k !== cb.dataset.col) : [...state.hidden, cb.dataset.col];
      Imm.refresh({ keepCount: true, keepScroll: true });
    });
    $("#cols-reset").addEventListener("click", () => {
      state.hidden = [...Imm.DEFAULT_HIDDEN];
      syncCols();
      Imm.refresh({ keepCount: true, keepScroll: true });
    });
    Imm.menu($("#btn-cols"), $("#col-menu"));

    // Paging and back-to-top: desktop scrolls inside the list pane, phones scroll the page.
    const onScroll = () => {
      const el = scroller();
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 1200) renderMore();
      $("#btn-top").hidden = el.scrollTop < 1200;
    };
    $("#list-wrap").addEventListener("scroll", () => { if (!Imm.isPhone()) onScroll(); }, { passive: true });
    window.addEventListener("scroll", () => { if (Imm.isPhone()) onScroll(); }, { passive: true });
    $("#btn-top").addEventListener("click", () => scrollToTop(true));
    $("#list-more").addEventListener("click", renderMore);
  };
})();
