// Sky calculations for the Imm Deep Sky Compendium web app.
// Replaces the workbook's VBA AstroFunctions module (altaz, transit, Sunrise,
// MoonRise, Moon, moonage, angularseperation) with astronomy-engine.
// Loads as a browser global (ImmAstro) or a CommonJS module for scripts/verify.mjs.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./vendor/astronomy-2.1.19.min.js"));
  } else {
    root.ImmAstro = factory(root.Astronomy);
  }
})(this, function (A) {
  "use strict";

  const DEG = Math.PI / 180;
  const HOUR_MS = 3600 * 1000;
  const DAY_MS = 24 * HOUR_MS;
  const SYNODIC_MONTH = 29.530588853;
  const SIDEREAL_RATE = 360.98564736629; // degrees of hour angle per solar day
  // The workbook's "Alt. Next 6 Hrs" columns: now, +2h, +4h, +6h.
  const ALT_OFFSETS_H = [0, 2, 4, 6];

  const norm360 = (x) => ((x % 360) + 360) % 360;

  function observer(lat, lon) {
    return new A.Observer(lat, lon, 0);
  }

  function dateOf(t) {
    return t ? t.date : null;
  }

  // Most recent local solar noon at or before `date`; anchors "tonight" so that
  // a time after midnight still shows the night that started the evening before.
  function previousNoon(obs, date) {
    let noon = A.SearchHourAngle(A.Body.Sun, obs, 0, new Date(date.getTime() - DAY_MS)).time;
    if (noon.date.getTime() + DAY_MS * 0.98 <= date.getTime()) {
      noon = A.SearchHourAngle(A.Body.Sun, obs, 0, new Date(noon.date.getTime() + DAY_MS / 2)).time;
    }
    return noon.date.getTime() <= date.getTime() ? noon : A.MakeTime(new Date(noon.date.getTime() - DAY_MS));
  }

  function sunAltitude(obs, date) {
    const eq = A.Equator(A.Body.Sun, date, obs, true, true);
    return A.Horizon(date, obs, eq.ra, eq.dec).altitude;
  }

  // Workbook Z8:AC8 "Sun Status": 0 = dark (sun below -12°), 1 = twilight, 2 = day.
  function sunStatus(alt) {
    return alt < -12 ? 0 : alt < 0 ? 1 : 2;
  }

  function phaseName(phaseDeg) {
    const names = ["New", "Waxing crescent", "First quarter", "Waxing gibbous",
      "Full", "Waning gibbous", "Last quarter", "Waning crescent"];
    return names[Math.floor(norm360(phaseDeg + 22.5) / 45) % 8];
  }

  /** Sun, Moon and twilight summary for the night containing `date`. */
  function sky(date, lat, lon) {
    const obs = observer(lat, lon);
    const noon = previousNoon(obs, date);
    const sunset = A.SearchRiseSet(A.Body.Sun, obs, -1, noon, 1);
    const nautDusk = A.SearchAltitude(A.Body.Sun, obs, -1, noon, 1, -12);
    const dawnFrom = nautDusk || sunset || noon;
    const nautDawn = A.SearchAltitude(A.Body.Sun, obs, +1, dawnFrom, 1, -12);
    const sunrise = A.SearchRiseSet(A.Body.Sun, obs, +1, sunset || noon, 1.5);

    // Workbook picks the next moonrise / moonset after the selected time.
    const moonRise = A.SearchRiseSet(A.Body.Moon, obs, +1, date, 2);
    const moonSet = A.SearchRiseSet(A.Body.Moon, obs, -1, date, 2);
    const phase = A.MoonPhase(date);
    // Age = time since the previous new moon.
    let newMoon = A.SearchMoonPhase(0, new Date(date.getTime() - 31 * DAY_MS), 32);
    for (let next; newMoon && (next = A.SearchMoonPhase(0, newMoon.AddDays(1), 31)) && next.date <= date;) newMoon = next;
    const illum = A.Illumination(A.Body.Moon, date).phase_fraction * 100;
    const moonEq = A.Equator(A.Body.Moon, date, obs, true, true);
    const moonHor = A.Horizon(date, obs, moonEq.ra, moonEq.dec, "normal");

    return {
      sunset: dateOf(sunset),
      nautDusk: dateOf(nautDusk),
      nautDawn: dateOf(nautDawn),
      sunrise: dateOf(sunrise),
      sunAlt: sunAltitude(obs, date),
      sunStatus: ALT_OFFSETS_H.map((h) => sunStatus(sunAltitude(obs, new Date(date.getTime() + h * HOUR_MS)))),
      moon: {
        rise: dateOf(moonRise),
        set: dateOf(moonSet),
        phase,
        phaseName: phaseName(phase),
        age: newMoon ? (date.getTime() - newMoon.date.getTime()) / DAY_MS : (phase / 360) * SYNODIC_MONTH,
        illum,
        ra: moonEq.ra * 15,
        dec: moonEq.dec,
        alt: moonHor.altitude,
      },
    };
  }

  /** Workbook Main!AH "Moon index" (0-100; higher is better), ported verbatim. */
  function moonIndex(illum, sep) {
    const s = sep / 100;
    let v;
    if (illum > 80) v = 30 * s;
    else if (illum > 70) v = 50 * s;
    else if (illum > 60) v = 5 + 50 * s;
    else if (illum > 50) v = 10 + 60 * s;
    else if (illum > 40) v = 15 + 70 * s;
    else if (illum > 30) v = 20 + 70 * s;
    else if (illum > 20) v = 40 + 55 * s;
    else v = 80 + (20 - illum) + 30 * s;
    return Math.min(100, v);
  }

  /** Workbook Main!AF: maximum (transit) altitude. */
  function maxAltitude(dec, lat) {
    return 90 - Math.abs(lat - dec);
  }

  function separation(ra1, dec1, ra2, dec2) {
    const c = Math.sin(dec1 * DEG) * Math.sin(dec2 * DEG) +
      Math.cos(dec1 * DEG) * Math.cos(dec2 * DEG) * Math.cos((ra1 - ra2) * DEG);
    return Math.acos(Math.max(-1, Math.min(1, c))) / DEG;
  }

  /**
   * Per-object values for every object (J2000 `ra`/`dec` in degrees).
   * Returns parallel typed arrays indexed like `objects`:
   *   alt0..alt3  altitude (deg) now, +2h, +4h, +6h      (Main!Z:AC)
   *   transit     next meridian transit, epoch ms         (Main!AD)
   *   untilTransit fraction of a day until transit        (Main!BK, "Transit Sort" key)
   *   maxAlt, moonSep, moonIdx                            (Main!AF, AG, AH)
   *   az          azimuth now, degrees from north          (6th edition "Obj. Azi.")
   */
  function objects(list, date, lat, lon, moon) {
    const n = list.length;
    const time = A.MakeTime(date);
    const rot = A.Rotation_EQJ_EQD(time).rot; // precession + nutation, J2000 -> of-date
    const gast = A.SiderealTime(time) * 15;
    const sinLat = Math.sin(lat * DEG), cosLat = Math.cos(lat * DEG);
    const out = {
      alt: ALT_OFFSETS_H.map(() => new Float64Array(n)),
      transit: new Float64Array(n),
      untilTransit: new Float64Array(n),
      maxAlt: new Float64Array(n),
      moonSep: new Float64Array(n),
      moonIdx: new Float64Array(n),
      az: new Float64Array(n),
    };
    for (let i = 0; i < n; i++) {
      const o = list[i];
      const ca = Math.cos(o.ra * DEG), sa = Math.sin(o.ra * DEG);
      const cd = Math.cos(o.dec * DEG), sd = Math.sin(o.dec * DEG);
      const x = cd * ca, y = cd * sa, z = sd;
      const X = rot[0][0] * x + rot[1][0] * y + rot[2][0] * z;
      const Y = rot[0][1] * x + rot[1][1] * y + rot[2][1] * z;
      const Z = rot[0][2] * x + rot[1][2] * y + rot[2][2] * z;
      const ra = norm360(Math.atan2(Y, X) / DEG);
      const dec = Math.asin(Math.max(-1, Math.min(1, Z))) / DEG;
      const sinDec = Math.sin(dec * DEG), cosDec = Math.cos(dec * DEG);

      const ha = norm360(gast + lon - ra); // hour angle now, degrees
      for (let k = 0; k < ALT_OFFSETS_H.length; k++) {
        const h = (ha + (ALT_OFFSETS_H[k] / 24) * SIDEREAL_RATE) * DEG;
        out.alt[k][i] = Math.asin(sinLat * sinDec + cosLat * cosDec * Math.cos(h)) / DEG;
      }
      // Azimuth now, degrees clockwise from north (workbook "Obj. Azi.", 6th edition).
      const H = ha * DEG;
      out.az[i] = norm360(Math.atan2(-Math.sin(H) * cosDec, sinDec * cosLat - cosDec * sinLat * Math.cos(H)) / DEG);
      const days = norm360(360 - ha) / SIDEREAL_RATE;
      out.untilTransit[i] = days;
      out.transit[i] = date.getTime() + days * DAY_MS;
      out.maxAlt[i] = maxAltitude(o.dec, lat);
      out.moonSep[i] = separation(moon.ra, moon.dec, ra, dec);
      out.moonIdx[i] = moonIndex(moon.illum, out.moonSep[i]);
    }
    return out;
  }

  return { sky, objects, moonIndex, maxAltitude, separation, ALT_OFFSETS_H };
});
