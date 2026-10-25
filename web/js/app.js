// App shell: views and hash routing, theme, My list page, and start-up.
// Routes: #/catalog, #/tonight, #/my, #/info/<page>, #/object/<id>.
(() => {
  "use strict";
  const Imm = window.Imm;
  const { $, $$, state, store } = Imm;

  const VIEWS = ["catalog", "tonight", "my", "info"];
  const INFO_PAGES = ["about", "guide", "classes", "definitions", "references"];
  let view = "catalog", infoPage = "about";

  Imm.viewHash = () => (view === "info" ? `#/info/${infoPage}` : `#/${view}`);

  // ---------- Tonight panel open/closed (desktop and tablet; phones use the Tonight tab) ----------
  function setTonightOpen(open) {
    document.body.classList.toggle("tonight-open", open);
    $("#tonight-btn").setAttribute("aria-expanded", String(open));
    store.set("tonightOpen", open);
  }

  // ---------- views ----------
  function showView(v, sub) {
    if (!VIEWS.includes(v)) v = "catalog";
    if (v === "tonight" && !Imm.isPhone()) { setTonightOpen(true); v = "catalog"; }
    const changed = v !== view;
    view = v;
    document.body.dataset.view = v;
    $("#view-catalog").hidden = !(v === "catalog" || v === "tonight");
    $("#view-my").hidden = v !== "my";
    $("#view-info").hidden = v !== "info";
    if (v === "info") {
      infoPage = INFO_PAGES.includes(sub) ? sub : infoPage;
      INFO_PAGES.forEach((p) => { $(`#info-${p}`).hidden = p !== infoPage; });
      $$("[data-info]").forEach((a) => a.setAttribute("aria-current", a.dataset.info === infoPage ? "page" : "false"));
    }
    if (v === "my") renderMy();
    $$("[data-nav]").forEach((a) => {
      const on = a.dataset.nav === v || (a.dataset.nav === "catalog" && v === "tonight" && !a.closest(".bottomnav"));
      a.setAttribute("aria-current", on ? "page" : "false");
    });
    store.set("route", Imm.viewHash());
    if (changed && Imm.isPhone()) window.scrollTo({ top: 0 });
    if (v === "info" && !Imm.isPhone()) $("#view-info").scrollTop = 0;
  }

  // Navigate to a view; { onlyIfAway } skips it when the catalog is already showing.
  Imm.go = (v, { onlyIfAway } = {}) => {
    if (onlyIfAway && (view === "catalog" || (view === "tonight" && !Imm.isPhone()))) return;
    location.hash = `#/${v}`;
  };

  function route() {
    const [a, b] = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    if (a === "object") {
      const i = Imm.INDEX.get(b);
      if (i != null) {
        if (Imm.detailIndex() !== i) Imm.openDetail(i, { fromRoute: true });
        return;
      }
      history.replaceState(null, "", Imm.viewHash());
      return;
    }
    Imm.closeDetail();
    // Old links to the reference tabs (#about) still work.
    if (INFO_PAGES.includes(a)) return showView("info", a);
    showView(a || "catalog", b);
  }

  // ---------- My list page ----------
  function renderMy() {
    const c = Imm.myCounts();
    const rows = [["any", "Everything flagged", ""], ["1", "Priority 1", "p1"], ["2", "Priority 2", "p2"], ["3", "Priority 3", "p3"],
      ["p", "Planned", ""], ["i", "In progress", ""], ["f", "Finished", ""]];
    $("#my-groups").innerHTML = rows.map(([v, label, cls]) => `
      <button type="button" class="my-row" data-mine="${v}" ${c[v] ? "" : "disabled"}>
        ${cls ? `<span class="pill pri ${cls}">P${v}</span>` : ""}<span class="my-label">${label}</span>
        <span class="my-n">${c[v].toLocaleString()}</span>${Imm.icon("chevron-right")}
      </button>`).join("");
    $("#my-empty").hidden = c.any > 0;
  }

  // ---------- theme ----------
  const THEME_ICON = { auto: "auto", light: "sun", dark: "moon", night: "eye" };
  function applyTheme() {
    const root = document.documentElement;
    if (state.theme === "auto") delete root.dataset.theme;
    else root.dataset.theme = state.theme;
    $("#theme-icon").setAttribute("href", `#i-${THEME_ICON[state.theme] || "auto"}`);
    $$("[data-theme-opt]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.themeOpt === state.theme)));
    $("#night-btn").setAttribute("aria-pressed", String(state.theme === "night"));
    // Browser chrome colour follows the page background.
    requestAnimationFrame(() => {
      $('meta[name="theme-color"]').content = getComputedStyle(document.body).backgroundColor;
    });
  }
  function setTheme(t) {
    if (t === "night" && state.theme !== "night") store.set("dayTheme", state.theme);
    state.theme = t;
    applyTheme();
    Imm.saveSettings();
    Imm.rerenderList(); // heat colours are inline styles
  }

  function init() {
    applyTheme();
    Imm.initReference();
    Imm.initTonight();
    Imm.initFilterPanel();
    Imm.initList();
    Imm.initDetail();
    Imm.compute();
    Imm.refresh({ keepScroll: true });

    // Top bar.
    $("#tonight-btn").addEventListener("click", () => {
      if (Imm.isPhone()) return Imm.go("tonight");
      const open = !document.body.classList.contains("tonight-open");
      setTonightOpen(open);
      if (view !== "catalog") Imm.go("catalog");
    });
    $("#tonight-close").addEventListener("click", () => setTonightOpen(false));
    setTonightOpen(store.get("tonightOpen", Imm.firstVisit));
    Imm.menu($("#theme-btn"), $("#theme-menu"));
    $("#theme-menu").addEventListener("click", (e) => {
      const b = e.target.closest("[data-theme-opt]");
      if (!b) return;
      setTheme(b.dataset.themeOpt);
      Imm.closeMenus();
    });
    $("#night-btn").addEventListener("click", () => setTheme(state.theme === "night" ? store.get("dayTheme", "auto") : "night"));

    // My list page.
    $("#my-groups").addEventListener("click", (e) => {
      const b = e.target.closest("[data-mine]");
      if (!b) return;
      state.f.mine = b.dataset.mine;
      Imm.go("catalog");
      Imm.refresh();
    });
    $("#btn-export").addEventListener("click", () => {
      $("#my-msg").textContent = `Exported ${Imm.exportMy()} object(s).`;
    });
    $("#import-file").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        $("#my-msg").textContent = `Imported ${await Imm.importMy(file)} object(s).`;
      } catch (err) {
        $("#my-msg").textContent = `Couldn't read that file: ${err.message}`;
      }
      e.target.value = "";
      renderMy();
    });
    Imm.on("my", () => { if (view === "my") renderMy(); });

    // "/" focuses search; keeps typing in fields alone.
    document.addEventListener("keydown", (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest("input, textarea, select, [contenteditable]") || Imm.detailOpen()) return;
      e.preventDefault();
      $("#search").focus();
      $("#search").select();
    });

    // Sticky offsets follow the real top-bar height (it wraps on phones).
    new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty("--topbar-h", `${Math.round(entry.target.getBoundingClientRect().height)}px`);
    }).observe($(".topbar"));

    // Crossing a breakpoint switches the list between table and cards and the filters between sidebar and drawer.
    const onBreakpoint = () => { Imm.closeFilters(); Imm.rerenderList(); route(); };
    matchMedia("(max-width: 639px)").addEventListener("change", onBreakpoint);
    matchMedia("(min-width: 1024px)").addEventListener("change", onBreakpoint);

    window.addEventListener("hashchange", route);
    if (!location.hash || location.hash === "#") history.replaceState(null, "", store.get("route", "#/catalog"));
    else if (/^#\/object\//.test(location.hash)) {
      // Deep link to an object: show the last view underneath so closing the card lands there.
      const id = decodeURIComponent(location.hash.slice("#/object/".length));
      history.replaceState(null, "", store.get("route", "#/catalog"));
      route();
      Imm.openDetail(Imm.INDEX.get(id));
      return;
    }
    route();
  }

  init();
})();
