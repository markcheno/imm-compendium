// Shared helpers for the Imm Deep Sky Compendium web app.
// Every script adds to the window.Imm namespace; load order is set in index.html.
(() => {
  "use strict";

  const Imm = (window.Imm = window.Imm || {});
  const D = window.IMM_DATA;
  Imm.D = D;
  Imm.OBJ = D.objects;
  Imm.N = D.objects.length;
  Imm.Astro = window.ImmAstro;
  Imm.HOUR_MS = 3600000;
  Imm.DAY_MS = 86400000;

  Imm.$ = (sel, root = document) => root.querySelector(sel);
  Imm.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Object id -> index into OBJ (deep links use ids).
  Imm.INDEX = new Map(D.objects.map((o, i) => [o.id, i]));

  // ---------- storage (per-browser conveniences; every access may throw) ----------
  Imm.store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem("imm." + key);
        return v == null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("imm." + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    },
  };

  // ---------- tiny event bus: Imm.on("refresh", fn), Imm.emit("refresh") ----------
  const handlers = new Map();
  Imm.on = (name, fn) => { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(fn); };
  Imm.emit = (name, ...args) => (handlers.get(name) || []).forEach((fn) => fn(...args));

  Imm.isPhone = () => matchMedia("(max-width: 639px)").matches;
  Imm.isDesktop = () => matchMedia("(min-width: 1024px)").matches;
  Imm.icon = (name, cls = "") => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  // ---------- formatting ----------
  Imm.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  Imm.fmtNum = (v, digits = 0) => (typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: digits }) : Imm.esc(v ?? ""));
  Imm.isMilkyWay = (o) => o.type === "Neb" || o.type === "Stars";
  const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  Imm.compass = (az) => COMPASS[Math.round((((az % 360) + 360) % 360) / 22.5) % 16];
  Imm.collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  // "2026 · 6th Edition" (or with the revision: "2026, 6th Edition, rev 6b").
  Imm.editionText = (withRev) => {
    const e = D.edition || {};
    if (!e.year) return e.title || "";
    return withRev ? `${e.year}, ${e.edition}${e.revision ? `, rev ${e.revision}` : ""}` : `${e.year} · ${e.edition}`;
  };
  Imm.fmtRA = (o) => {
    const s = o.raHms;
    return `${s.slice(0, 2)}h ${s.slice(2, 4)}m ${s.slice(4, 6)}s`;
  };
  Imm.fmtDec = (o) => {
    const v = Number(o.decDms);
    const s = String(Math.abs(v)).padStart(6, "0");
    return `${v < 0 ? "−" : "+"}${s.slice(0, 2)}° ${s.slice(2, 4)}′ ${s.slice(4, 6)}″`;
  };
  Imm.stars = (r) => {
    if (typeof r !== "number") return "";
    return `<span class="rating" title="Rating ${r} of 5" aria-label="Rating ${r} of 5">${"★".repeat(r)}<span class="off">${"★".repeat(5 - r)}</span></span>`;
  };

  // ---------- time zone helpers (read Imm.state, set up in state.js) ----------
  const browserTz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ""; } })();
  const offsetMs = (d) => (Imm.state.tz === "auto" ? -d.getTimezoneOffset() * 60000 : Number(Imm.state.tz) * Imm.HOUR_MS);
  const shifted = (d) => new Date(d.getTime() + offsetMs(d));
  const pad2 = (n) => String(n).padStart(2, "0");
  Imm.WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  Imm.MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  Imm.shifted = shifted;

  Imm.fmtTime = (d, withDay) => {
    if (!d) return "—";
    const s = shifted(d);
    let out = `${pad2(s.getUTCHours())}:${pad2(s.getUTCMinutes())}`;
    if (withDay) {
      const ref = shifted(Imm.state.time);
      if (s.getUTCDate() !== ref.getUTCDate() || s.getUTCMonth() !== ref.getUTCMonth()) out += ` ${Imm.WEEKDAY[s.getUTCDay()]}`;
    }
    return out;
  };
  Imm.fmtDate = (d) => {
    const s = shifted(d);
    return `${Imm.WEEKDAY[s.getUTCDay()]} ${s.getUTCDate()} ${Imm.MONTH[s.getUTCMonth()]}`;
  };
  Imm.toInputValue = (d) => shifted(d).toISOString().slice(0, 16);
  Imm.fromInputValue = (v) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
    if (!m) return null;
    const [y, mo, da, h, mi] = m.slice(1).map(Number);
    if (Imm.state.tz === "auto") return new Date(y, mo - 1, da, h, mi);
    return new Date(Date.UTC(y, mo - 1, da, h, mi) - Number(Imm.state.tz) * Imm.HOUR_MS);
  };
  Imm.startOfLocalDay = (d) => {
    const s = shifted(d);
    const midnightShifted = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
    return new Date(midnightShifted - offsetMs(d));
  };
  Imm.tzLabel = (v) => {
    if (v === "auto") return `Device${browserTz ? ` (${browserTz})` : ""}`;
    const n = Number(v), sign = n < 0 ? "−" : "+", a = Math.abs(n);
    return `UTC${sign}${Math.floor(a)}${a % 1 ? ":" + pad2(Math.round((a % 1) * 60)) : ""}`;
  };

  // Accepts "31.784", "-95 05 36", "31°47'03\"N", "95 5 36 W".
  Imm.parseAngle = (str) => {
    if (str == null) return NaN;
    const s = String(str).trim().toUpperCase();
    if (!s) return NaN;
    const neg = /^-/.test(s) || /[SW]$/.test(s);
    const nums = s.replace(/[NSEW]/g, " ").match(/\d+(?:\.\d+)?/g);
    if (!nums) return NaN;
    const [d, m = 0, sec = 0] = nums.map(Number);
    const v = d + m / 60 + sec / 3600;
    return neg ? -v : v;
  };

  // ---------- popover menus: one open at a time, closed by outside click or Escape ----------
  const menus = [];
  Imm.menu = (btn, menu) => {
    menus.push([btn, menu]);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menu.hidden;
      Imm.closeMenus();
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    });
  };
  Imm.closeMenus = () => menus.forEach(([b, m]) => { m.hidden = true; b.setAttribute("aria-expanded", "false"); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".menu")) Imm.closeMenus(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") Imm.closeMenus(); });
})();
