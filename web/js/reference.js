// Info pages built from the workbook's reference tabs: About, User Guide, Types & Classes, Definitions, References.
(() => {
  "use strict";
  const Imm = window.Imm;
  const { $, $$, D, OBJ, esc } = Imm;

  function cellHtml(c) {
    if (!c) return "";
    const t = esc(c.t);
    const main = c.link ? `<a href="${esc(c.link)}" target="_blank" rel="noopener">${t}</a>` : t;
    return main + (c.note ? `<span class="note">${esc(c.note)}</span>` : "");
  }
  // The workbook's own links: latest Compendium version, companion eBook, scholarship fund.
  const AUTHOR_LINKS = D.userGuide.filter((b) => b.link).map((b) => {
    const label = b.title.replace(/^Link to /, "");
    return { label: label[0].toUpperCase() + label.slice(1), href: b.link };
  });
  const ASTROBIN = "https://www.astrobin.com/users/GaryI/";
  const linkBtn = (l) => `<a class="btn" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}${Imm.icon("external", "sm")}</a>`;

  function renderAbout() {
    const welcome = D.userGuide.find((b) => /^Welcome/.test(b.title));
    $("#info-about").innerHTML = `
      <h2>About the Imm Deep Sky Compendium</h2>
      <div class="block credit">
        <p class="flow">The <strong>Imm Deep Sky Compendium</strong> was created by <strong>Gary Imm</strong>, an astrophotographer in Onalaska, Texas.
        Every object in it was selected, rated, classified and described by him, and the thumbnails are his own images
        (${OBJ.filter((o) => o.astrobin).length.toLocaleString()} of the objects link to his full-resolution images on Astrobin).
        He publishes the Compendium as a free Excel workbook for astrophotographers.</p>
        <div class="link-row">
          ${linkBtn({ label: "Gary Imm on Astrobin", href: ASTROBIN })}
          ${AUTHOR_LINKS.map(linkBtn).join("")}
        </div>
      </div>
      ${welcome ? `<div class="block"><h3>From the author</h3><p>${esc(welcome.body)}</p></div>` : ""}
      <div class="block"><h3>About this web version</h3>
        <p class="flow">This is an unofficial adaptation of the ${esc(Imm.editionText(true))} workbook so it can be used in a browser or on a phone without Excel or macros. The object data, notes, ratings, classifications, catalogue cross-references and images are unchanged from the workbook and remain © Gary Imm. Corrections and new editions come from him: get the latest version from the link above.</p>
        <p class="flow">Differences from the workbook: sky positions, rise/set and transit times are computed with <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener">Astronomy Engine</a> instead of the workbook's macros (results agree to within a minute or so, and a fraction of a degree in altitude); moon illumination is computed directly instead of from a lookup table${D.coordFixes?.length ? `; and ${D.coordFixes.length} object${D.coordFixes.length > 1 ? "s" : ""} with mistyped decimal coordinates in the workbook (${esc(D.coordFixes.join(", "))}) use${D.coordFixes.length > 1 ? "" : "s"} the original RA/Dec` : ""}.</p>
      </div>`;
  }

  function renderGuide() {
    const blocks = D.userGuide.filter((b) => !b.link && !/^Welcome/.test(b.title));
    $("#info-guide").innerHTML = `
      <h2>User Guide</h2>
      <p class="muted">From Gary Imm's workbook. References to cells, spin buttons and macros describe the Excel version; the web equivalents are below.</p>
      <div class="block"><h3>Using the web version</h3>
        <p class="flow"><strong>Tonight</strong> (the date and moon button at the top, or the Tonight tab on a phone) sets the date, time and place; the time zone comes from your device unless you pick one. It also shows sunset, nautical dusk and dawn, sunrise, and the moon. Use <em>Live</em> to follow the clock, or step the time with − / + in 10-minute, hour, day or month steps.</p>
        <p class="flow"><strong>Filters</strong> (the sidebar, or the Filters button) hold every filter button and dropdown from the workbook: object types and features, catalogues, Top Targets (which stack on the other filters), constellation, Dec and size ranges, altitude in the next 6 hours, and your own status. Active filters show as chips above the list; tap one to remove it.</p>
        <p class="flow"><strong>Search</strong> matches names, nicknames, catalogue numbers (“m31”, “sh2-155”) and notes. Press <kbd>/</kbd> to jump to it.</p>
        <p class="flow">Tap or click any object for its full card, links, and <strong>My plan</strong>: your priority, status and notes, saved in this browser. <strong>My list</strong> shows what you've flagged and backs it up to a file. In the card, ← / → step through the list.</p>
      </div>
      ${D.quickStart ? `<div class="block"><h3>Quick Start (from the workbook)</h3><p>${esc(D.quickStart)}</p></div>` : ""}
      ${blocks.map((b) => `<div class="block"><h3>${esc(b.title)}</h3><p>${esc(b.body)}</p></div>`).join("")}`;
  }
  function renderClasses() {
    const rows = D.types.filter((r) => r.r >= 2);
    const typeRows = rows.map((r) => `<tr><td>${cellHtml(r.cells.A)}</td><td>${cellHtml(r.cells.B)}</td></tr>`).join("");
    $("#info-classes").innerHTML = `
      <h2>Object types &amp; subtypes</h2>
      ${D.types[0]?.cells.A ? `<p class="muted">${esc(D.types[0].cells.A.t)}</p>` : ""}
      <div class="table-scroll"><table>${typeRows}</table></div>
      <h2>Object class codes</h2>
      <div class="cols">${D.classGuide.map((b) => `<div class="block"><h3>${esc(b.title)}</h3><p>${esc(b.body)}</p></div>`).join("")}</div>`;
  }
  function renderDefinitions() {
    const [title, ...rows] = D.definitions;
    const body = rows.map((r) => {
      const { A, B } = r.cells;
      if (A && !B) return `<tr><td class="section" colspan="2">${cellHtml(A)}</td></tr>`;
      return `<tr><td>${cellHtml(A)}</td><td>${cellHtml(B)}</td></tr>`;
    }).join("");
    $("#info-definitions").innerHTML = `<h2>Definitions</h2><p class="muted">${esc(title?.cells.A?.t || "")}</p>
      <div class="table-scroll"><table>${body}</table></div>`;
  }
  function renderReferences() {
    const [title, ...rows] = D.references;
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r.cells)))].sort();
    const body = rows.map((r, k) => {
      const tag = k === 0 ? "th" : "td";
      return `<tr>${cols.map((c) => `<${tag}>${cellHtml(r.cells[c])}</${tag}>`).join("")}</tr>`;
    }).join("");
    $("#info-references").innerHTML = `<h2>${esc(title?.cells.A?.t || "References")}</h2><div class="table-scroll"><table>${body}</table></div>`;
  }

  function creditsHtml() {
    const latest = AUTHOR_LINKS[0];
    return `<p>The <strong>Imm Deep Sky Compendium</strong> (${esc(Imm.editionText(true))}), including all object data, ratings, classifications, notes and images, is the work of
      <a href="${ASTROBIN}" target="_blank" rel="noopener">Gary Imm</a>, © Gary Imm. Images taken from Onalaska, TX, USA.</p>
      <p>This is an unofficial web adaptation of his free Excel workbook and is not produced by Gary Imm. For the original, see
      ${latest ? `<a href="${esc(latest.href)}" target="_blank" rel="noopener">the latest Compendium download</a> or ` : ""}<a href="${ASTROBIN}" target="_blank" rel="noopener">his Astrobin page</a>.
      <a href="#/info/about">About &amp; credits</a></p>
      <p>Sky calculations by <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener">Astronomy Engine</a> (MIT, Don Cross).</p>`;
  }

  Imm.initReference = () => {
    renderAbout();
    renderGuide();
    renderClasses();
    renderDefinitions();
    renderReferences();
    $$("[data-credits]").forEach((el) => { el.innerHTML = creditsHtml(); });
    $$("[data-edition]").forEach((el) => { el.textContent = Imm.editionText(el.dataset.edition === "rev"); });
  };
})();
