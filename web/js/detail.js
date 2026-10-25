// Object detail: side drawer on desktop, full-screen sheet on phones. Deep-linkable as #/object/<id>.
(() => {
  "use strict";
  const Imm = window.Imm;
  const { $, state, OBJ, esc, fmtNum, fmtTime, Astro, HOUR_MS, STATUS } = Imm;

  let current = null;  // index of the object shown
  let pushed = false;  // whether opening added a history entry (closing then goes back)
  let routeClose = false;

  const dlg = () => $("#detail");
  Imm.detailOpen = () => dlg().open;
  Imm.detailIndex = () => (dlg().open ? current : null);

  function seg(name, value, options) {
    return `<div class="seg seg-full" role="group" data-my="${name}">${options.map(([v, l]) =>
      `<button type="button" data-v="${v}" aria-pressed="${String(v === value)}">${l}</button>`).join("")}</div>`;
  }

  function render(i) {
    const o = OBJ[i], m = Imm.myOf(o), calc = Imm.calc;
    const hours = Astro.ALT_OFFSETS_H;
    const pos = Imm.view.indexOf(i);
    const cats = Object.entries(o.cats || {}).map(([c, n]) => {
      const link = Imm.D.catalogLinks[c];
      return `<div><dt>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(c)}</a>` : esc(c)}</dt><dd>${esc(n)}</dd></div>`;
    }).join("");
    const unit = Imm.isMilkyWay(o) ? "ly" : "Mly";
    const dunit = Imm.isMilkyWay(o) ? "ly" : "kly";
    const field = (label, value) => (value == null || value === "" ? "" : `<div><dt>${label}</dt><dd>${value}</dd></div>`);
    dlg().innerHTML = `
      <header class="d-top">
        <button type="button" class="icon-btn" data-close aria-label="Close">${Imm.icon("chevron-left", "phone-only")}${Imm.icon("x", "not-phone")}</button>
        <p class="d-top-title">${esc(o.name)}</p>
        ${pos >= 0 ? `<div class="d-nav">
          <button type="button" class="icon-btn" data-go="-1" aria-label="Previous object" ${pos === 0 ? "disabled" : ""}>${Imm.icon("chevron-left")}</button>
          <span class="d-pos">${(pos + 1).toLocaleString()} / ${Imm.view.length.toLocaleString()}</span>
          <button type="button" class="icon-btn" data-go="1" aria-label="Next object" ${pos === Imm.view.length - 1 ? "disabled" : ""}>${Imm.icon("chevron-right")}</button>
        </div>` : ""}
      </header>
      <div class="d-scroll">
        <div class="d-head">
          ${o.thumb ? `<figure class="d-fig"><img src="${o.thumb}" alt="${esc(o.name)}, image by Gary Imm" width="130" height="130"><figcaption>Image © Gary Imm</figcaption></figure>` : ""}
          <div class="d-id">
            <h2 id="d-name">${esc(o.name)}</h2>
            ${o.nick ? `<p class="nick">${esc(o.nick)}</p>` : ""}
            <p class="d-type">${esc(o.type)} · ${esc(o.sub)}${o.cls ? ` · <code>${esc(o.cls)}</code>` : ""}${o.con ? ` · ${esc(o.con)}` : ""}</p>
            <p>${Imm.stars(o.rating)}</p>
          </div>
        </div>
        <div class="d-links">${Imm.linksHtml(o, false)}</div>

        <section class="d-sec d-mine">
          <h3>My plan</h3>
          <form id="my-form" class="my-form">
            <div class="field"><span>Priority</span>${seg("p", m.p ? String(m.p) : "", [["", "—"], ["1", "1"], ["2", "2"], ["3", "3"]])}</div>
            <div class="field"><span>Status</span>${seg("s", m.s || "", [["", "—"], ...Object.entries(STATUS)])}</div>
            <label class="field"><span>Notes</span><textarea name="n" rows="2" placeholder="Your notes for this object">${esc(m.n || "")}</textarea></label>
          </form>
        </section>

        <section class="d-sec">
          <h3>Tonight <span class="muted">· ${esc(Imm.fmtDate(state.time))} ${esc(fmtTime(state.time))}</span></h3>
          <div class="d-alts">${hours.map((h, k) => `<div style="${Imm.altHeat(calc.alt[k][i])}">${Math.round(calc.alt[k][i])}°<small>${fmtTime(new Date(state.time.getTime() + h * HOUR_MS))}</small></div>`).join("")}</div>
          <dl class="d-grid">
            ${field("Transit", fmtTime(new Date(calc.transit[i]), true))}
            ${field("Azimuth now", `${Math.round(calc.az[i]) % 360}° ${Imm.compass(calc.az[i])}`)}
            ${field("Max altitude", `${Math.round(calc.maxAlt[i])}°`)}
            ${field("Moon separation", `${Math.round(calc.moonSep[i])}°`)}
            ${field("Moon index", `<span class="heat-tag" style="${Imm.moonHeat(calc.moonIdx[i])}">${Math.round(calc.moonIdx[i])}</span>`)}
            ${field("Transits at midnight", Imm.transitDateText(o))}
          </dl>
        </section>

        ${o.notes ? `<section class="d-sec"><h3>Notes</h3><p class="d-notes">${esc(o.notes)}</p></section>` : ""}

        <section class="d-sec">
          <h3>Data</h3>
          <dl class="d-grid">
            ${field("Size", o.size != null ? `${fmtNum(o.size, 2)}′` : null)}
            ${field("Distance", o.dist != null ? `${fmtNum(o.dist, 1)} ${typeof o.dist === "number" ? unit : ""}` : null)}
            ${field("Diameter", o.diam != null ? `${fmtNum(o.diam, 1)} ${typeof o.diam === "number" ? dunit : ""}` : null)}
            ${field("RA (J2000)", Imm.fmtRA(o))}
            ${field("Dec (J2000)", Imm.fmtDec(o))}
            ${field("Visual mag", fmtNum(o.vmag, 1))}
            ${field("Surface brightness", fmtNum(o.sb, 1))}
            ${field("Inclination", o.incl != null ? `${fmtNum(o.incl)}°` : null)}
            ${field("Alt. ID", esc(o.altId))}
            ${field("Nearby", esc(o.nearby))}
            ${field("SIMBAD id", esc(o.key))}
          </dl>
        </section>
        ${cats ? `<section class="d-sec"><h3>Catalogues</h3><dl class="d-grid">${cats}</dl></section>` : ""}
        <p class="d-credit">Data, notes and image © Gary Imm${o.astrobin ? ` · <a href="${esc(o.astrobin)}" target="_blank" rel="noopener">full-resolution image on Astrobin</a>` : ""}</p>
      </div>`;

    const form = $("#my-form", dlg());
    const save = () => {
      const p = $('[data-my="p"] [aria-pressed="true"]', form)?.dataset.v;
      const s = $('[data-my="s"] [aria-pressed="true"]', form)?.dataset.v;
      Imm.setMy(o.id, { p: p ? Number(p) : undefined, s: s || undefined, n: form.n.value });
    };
    form.addEventListener("click", (e) => {
      const b = e.target.closest("[data-my] button");
      if (!b) return;
      b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      save();
    });
    form.n.addEventListener("input", save);
    form.addEventListener("submit", (e) => e.preventDefault());
  }

  const hashOf = (i) => Imm.objHref(OBJ[i]);

  Imm.openDetail = (i, { fromRoute = false } = {}) => {
    if (i == null || !OBJ[i]) return;
    const wasOpen = dlg().open;
    current = i;
    render(i);
    if (!fromRoute) {
      if (wasOpen) history.replaceState(null, "", hashOf(i));
      else { history.pushState(null, "", hashOf(i)); pushed = true; }
    } else if (!wasOpen) pushed = false;
    if (!wasOpen) dlg().showModal();
    $(".d-scroll", dlg()).scrollTop = 0;
    if (!wasOpen) $("[data-close]", dlg()).focus();
  };

  // Called by the router when the hash no longer names an object (e.g. the Back button).
  Imm.closeDetail = () => {
    if (!dlg().open) return;
    routeClose = true;
    dlg().close();
  };

  function step(d) {
    const pos = Imm.view.indexOf(current);
    const next = Imm.view[pos + d];
    if (pos < 0 || next == null) return;
    Imm.openDetail(next);
    $(`[data-go="${d}"]`, dlg())?.focus();
  }

  Imm.initDetail = () => {
    const el = dlg();
    el.addEventListener("click", (e) => {
      if (e.target === e.currentTarget || e.target.closest("[data-close]")) return el.close();
      const go = e.target.closest("[data-go]");
      if (go) step(Number(go.dataset.go));
    });
    el.addEventListener("keydown", (e) => {
      if (e.target.closest("textarea, input, select")) return;
      if (e.key === "ArrowRight" || e.key === "j") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowLeft" || e.key === "k") { e.preventDefault(); step(-1); }
    });
    el.addEventListener("close", () => {
      if (routeClose) { routeClose = false; pushed = false; return; }
      if (pushed) { pushed = false; history.back(); }
      else history.replaceState(null, "", Imm.viewHash());
    });
  };
})();
