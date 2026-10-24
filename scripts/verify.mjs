// Compare web/astro.js against the values the workbook last calculated (scripts/fixture.json).
// Usage: node scripts/verify.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const astro = require("../web/astro.js");
const fx = JSON.parse(readFileSync(new URL("./fixture.json", import.meta.url)));

const DAY_MS = 86400000;
const tzHours = fx.gmtOffset + (fx.dst ? 1 : 0);
// Excel serial (local wall time) -> UTC instant
const date = new Date((fx.serial - 25569) * DAY_MS - tzHours * 3600000);
const localFrac = (d) => ((((d.getTime() + tzHours * 3600000) / DAY_MS) % 1) + 1) % 1;
const minutesApart = (a, b) => {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d) * 1440;
};

const results = [];
function check(label, err, tol, unit) {
  results.push({ label, err, tol, unit, ok: err <= tol });
}

const sky = astro.sky(date, fx.lat, fx.lon);
console.log(`Workbook time: ${date.toISOString()}  lat ${fx.lat.toFixed(3)} lon ${fx.lon.toFixed(3)}`);
check("sunset", minutesApart(localFrac(sky.sunset), fx.sun.sunset), 2, "min");
check("nautical dusk", minutesApart(localFrac(sky.nautDusk), fx.sun.nautSet), 2, "min");
check("nautical dawn", minutesApart(localFrac(sky.nautDawn), fx.sun.nautRise), 2, "min");
check("sunrise", minutesApart(localFrac(sky.sunrise), fx.sun.sunrise), 2, "min");
check("moonrise", minutesApart(localFrac(sky.moon.rise), fx.moon.rise), 5, "min");
check("moonset", minutesApart(localFrac(sky.moon.set), fx.moon.set), 5, "min");
// The workbook's moonage() is an approximation; astro.js measures time since the last new moon.
check("moon age", Math.abs(sky.moon.age - fx.moon.age), 1, "days");
// The workbook interpolates illumination from a coarse age table; astro.js computes it.
check("moon illumination (vs table approx.)", Math.abs(sky.moon.illum - fx.moon.illum), 8, "%");
check("moon RA/Dec separation", astro.separation(sky.moon.ra, sky.moon.dec, fx.moon.ra, fx.moon.dec), 1.5, "deg");
check("sun status (mismatches)", sky.sunStatus.filter((s, i) => s !== fx.sunStatus[i]).length, 0, "");

const objs = astro.objects(fx.objects, date, fx.lat, fx.lon, sky.moon);
const max = (f) => Math.max(...fx.objects.map(f));
check("object altitude, 4 times", max((o, i) => Math.max(...[0, 1, 2, 3].map((k) => Math.abs(objs.alt[k][i] - o.alt[k])))), 0.5, "deg");
// The workbook computes transit for the previous day (transit(J2000_Bas-1, ...)) without
// precession, so it runs ~3-6 min late; we hold astro.js to astronomy-engine's own search.
check("object transit time (vs workbook)", max((o, i) => minutesApart(localFrac(new Date(objs.transit[i])), o.transitFrac)), 8, "min");
check("transit sort key (vs workbook)", max((o, i) => minutesApart(objs.untilTransit[i], o.timeSort)), 8, "min");
const A = require("../web/vendor/astronomy-2.1.19.min.js");
const obs = new A.Observer(fx.lat, fx.lon, 0);
check("object transit time (vs SearchHourAngle)", max((o, i) => {
  A.DefineStar(A.Body.Star1, o.ra / 15, o.dec, 1000);
  return Math.abs(A.SearchHourAngle(A.Body.Star1, obs, 0, date).time.date.getTime() - objs.transit[i]) / 60000;
}), 0.1, "min");
check("max altitude", max((o, i) => Math.abs(objs.maxAlt[i] - o.maxAlt)), 1e-6, "deg");
check("moon separation", max((o, i) => Math.abs(objs.moonSep[i] - o.moonSep)), 1.5, "deg");
check("moon index formula (sheet inputs)", max((o) => Math.abs(astro.moonIndex(fx.moon.illum, o.moonSep) - o.moonIndex)), 1e-6, "");
if (fx.objects[0].azimuth != null) {
  // The workbook uses unprecessed J2000 coordinates; a ~0.35° position offset becomes
  // offset/cos(alt) in azimuth, so compare the on-sky size of the gap (err × cos alt).
  const azErr = (o, i) => {
    const d = Math.abs(objs.az[i] - o.azimuth) % 360;
    return Math.min(d, 360 - d) * Math.cos((o.alt[0] * Math.PI) / 180);
  };
  check("object azimuth now (× cos alt)", max(azErr), 0.4, "deg");
}
check("moon index (our inputs)", max((o, i) => Math.abs(objs.moonIdx[i] - o.moonIndex)), 8, "");

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label.padEnd(38)} max err ${r.err.toFixed(3)} ${r.unit} (tol ${r.tol})`);
}
console.log(failed ? `${failed} check(s) failed` : `All ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
