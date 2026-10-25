// Time, location, sun and moon: the "Tonight" panel and the top-bar summary.
(() => {
  "use strict";
  const Imm = window.Imm;
  const { $, $$, state, store, Astro, OBJ, HOUR_MS, DAY_MS, fmtTime } = Imm;

  Imm.sky = null;
  Imm.calc = null;

  Imm.compute = () => {
    Imm.sky = Astro.sky(state.time, state.lat, state.lon);
    Imm.calc = Astro.objects(OBJ, state.time, state.lat, state.lon, Imm.sky.moon);
    renderSky();
  };

  Imm.moonPath = (phase) => {
    const r = 45, p = (phase * Math.PI) / 180;
    const waxing = phase < 180, crescent = Math.cos(p) > 0;
    const rx = Math.abs(Math.cos(p)) * r;
    const outer = waxing ? 1 : 0;
    const term = waxing ? (crescent ? 0 : 1) : (crescent ? 1 : 0);
    return `M0,${-r} A${r},${r} 0 0 ${outer} 0,${r} A${rx.toFixed(2)},${r} 0 0 ${term} 0,${-r} Z`;
  };
  const moonSvg = (m) => `<circle class="dark" r="45"/><path class="lit" d="${Imm.moonPath(m.phase)}"/>`;

  function renderSky() {
    const sky = Imm.sky, m = sky.moon;
    $("#s-sunset").textContent = fmtTime(sky.sunset, true);
    $("#s-dusk").textContent = fmtTime(sky.nautDusk, true);
    $("#s-dawn").textContent = fmtTime(sky.nautDawn, true);
    $("#s-sunrise").textContent = fmtTime(sky.sunrise, true);
    $("#m-rise").textContent = fmtTime(m.rise, true);
    $("#m-set").textContent = fmtTime(m.set, true);
    $("#m-age").textContent = `${m.age.toFixed(1)} d`;
    $("#m-illum").textContent = `${Math.round(m.illum)}%`;
    $("#m-phase").textContent = m.phaseName;
    $("#m-alt").textContent = m.alt > 0 ? `Up · alt ${Math.round(m.alt)}°` : "Below horizon";
    $("#moon-svg").innerHTML = moonSvg(m);
    $("#moon-svg").setAttribute("aria-label", `Moon ${m.phaseName}, ${Math.round(m.illum)}% illuminated`);
    if (document.activeElement !== $("#dt")) $("#dt").value = Imm.toInputValue(state.time);
    $("#tz-label").textContent = Imm.tzLabel(state.tz);
    $("#btn-live").setAttribute("aria-pressed", String(state.live));

    // Top-bar summary.
    $("#tb-moon").innerHTML = moonSvg(m);
    $("#tb-when").textContent = `${Imm.fmtDate(state.time)} · ${fmtTime(state.time)}`;
    $("#tb-where").textContent = `${state.lat.toFixed(2)}, ${state.lon.toFixed(2)} · dark ${fmtTime(sky.nautDusk)}–${fmtTime(sky.nautDawn)}`;
    $("#tb-live").hidden = !state.live;
    $("#tonight-btn").title = `${state.live ? "Live · " : ""}${Imm.fmtDate(state.time)} ${fmtTime(state.time)} · moon ${Math.round(m.illum)}% · change time or location`;
  }

  function setTime(d, { live = false } = {}) {
    if (!d || isNaN(d)) return;
    state.time = d;
    state.live = live;
    Imm.compute();
    Imm.refresh({ keepCount: true, keepScroll: true });
  }

  function setLocation(lat, lon, msg) {
    state.lat = lat;
    state.lon = lon;
    $("#lat").value = lat.toFixed(4);
    $("#lon").value = lon.toFixed(4);
    $("#loc-msg").textContent = msg || "";
    Imm.compute();
    Imm.refresh({ keepCount: true, keepScroll: true });
  }

  // Step sizes; months follow the workbook's MonthSpin (365/12 days).
  const UNIT_MS = { "10m": 10 * 60000, "1h": HOUR_MS, "1d": DAY_MS, "1M": (365 / 12) * DAY_MS };
  let unit = store.get("stepUnit", "1h");
  if (!UNIT_MS[unit]) unit = "1h";
  const syncUnits = () => $$("[data-unit]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.unit === unit)));

  Imm.initTonight = () => {
    const tzs = ["auto"];
    for (let h = -12; h <= 14; h += 0.5) tzs.push(h);
    tzs.push(5.75, 8.75, 12.75);
    tzs.sort((a, b) => (a === "auto" ? -1 : b === "auto" ? 1 : a - b));
    $("#tz").innerHTML = tzs.map((v) => `<option value="${v}">${Imm.tzLabel(v)}</option>`).join("");
    $("#tz").value = String(state.tz);
    $("#lat").value = state.lat.toFixed(4);
    $("#lon").value = state.lon.toFixed(4);
    if (Imm.firstVisit) $("#loc-msg").textContent = "Showing the author's site in Onalaska, TX. Enter your coordinates or use your location.";
    syncUnits();

    $("#dt").addEventListener("change", (e) => setTime(Imm.fromInputValue(e.target.value)));
    $("#btn-now").addEventListener("click", () => setTime(new Date(), { live: true }));
    $("#btn-sunset").addEventListener("click", () => {
      const now = new Date();
      const s = Astro.sky(new Date(Imm.startOfLocalDay(now).getTime() + 18 * HOUR_MS), state.lat, state.lon).sunset;
      if (s) setTime(s);
    });
    $("#btn-live").addEventListener("click", () => {
      if (state.live) { state.live = false; Imm.saveSettings(); renderSky(); }
      else setTime(new Date(), { live: true });
    });
    $$("[data-unit]").forEach((b) => b.addEventListener("click", () => {
      unit = b.dataset.unit;
      store.set("stepUnit", unit);
      syncUnits();
    }));
    $$("[data-step-dir]").forEach((b) => b.addEventListener("click", () => {
      setTime(new Date(state.time.getTime() + Number(b.dataset.stepDir) * UNIT_MS[unit]));
    }));
    setInterval(() => { if (state.live) setTime(new Date(), { live: true }); }, 60000);

    const onLoc = () => {
      const lat = Imm.parseAngle($("#lat").value), lon = Imm.parseAngle($("#lon").value);
      if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) {
        $("#loc-msg").textContent = "Enter latitude −90…90 and longitude −180…180 (decimal or “d m s”).";
        return;
      }
      setLocation(lat, lon, "");
    };
    $("#lat").addEventListener("change", onLoc);
    $("#lon").addEventListener("change", onLoc);
    $("#tz").addEventListener("change", (e) => {
      state.tz = e.target.value === "auto" ? "auto" : Number(e.target.value);
      Imm.saveSettings();
      renderSky();
      Imm.refresh({ keepCount: true, keepScroll: true });
    });
    $("#btn-geo").addEventListener("click", () => {
      if (!navigator.geolocation) { $("#loc-msg").textContent = "Location isn't available in this browser."; return; }
      $("#loc-msg").textContent = "Locating…";
      navigator.geolocation.getCurrentPosition(
        (p) => setLocation(p.coords.latitude, p.coords.longitude, `Using your location (±${Math.round(p.coords.accuracy)} m).`),
        (err) => { $("#loc-msg").textContent = `Couldn't get your location: ${err.message || "permission denied"}. Enter it by hand instead.`; },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
      );
    });
  };
})();
