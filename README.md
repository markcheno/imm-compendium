# Imm Deep Sky Compendium — web app

> **Credit:** The Imm Deep Sky Compendium — every object selection, rating, classification, note and image — is the work of **[Gary Imm](https://www.astrobin.com/users/GaryI/)** and remains © Gary Imm. This repository is an unofficial web adaptation of his free Excel workbook and is not produced by him. Get the original and his companion eBook through the links on the app's *About* tab, and consider supporting the [Imm Astronomy Scholarship Fund](https://bold.org/funds/imm-astronomy-scholarship-fund/) as he asks.

A static web version of Gary Imm's *Imm Deep Sky Compendium – 2026 – rev6b.xlsm* (6th Edition): 3,145 deep sky objects with thumbnails, notes, catalogue cross-references, every filter button from the workbook, and live altitude / transit / moon data for your location and time. No Excel, no macros, no server.

**Open `web/index.html` in a browser** (double-click works; everything loads from local files).

## Layout

```
web/
  index.html                      app shell (no build step; classic scripts, so file:// works)
  css/base.css                    design tokens and light / dark / night themes
  css/layout.css                  shell, sidebar / drawer / bottom sheet, bottom nav, breakpoints
  css/components.css              controls, Tonight cards, table, cards, detail view, pages
  js/core.js                      window.Imm namespace, helpers, storage, event bus
  js/config.js                    workbook-derived filter buttons, dropdowns, catalogue labels, colour scales
  js/state.js                     settings and "my data" (priority / status / notes), export / import
  js/filters.js                   Excel AutoFilter matching, search, sorting, active-filter list
  js/columns.js                   table columns and shared renderers
  js/tonight.js                   time, location, sun and moon
  js/list.js                      table / card list, paging, sort menu, column chooser
  js/filter-panel.js              filter controls, active-filter chips
  js/detail.js                    object detail drawer / sheet (#/object/<id>)
  js/reference.js                 About, User Guide, Types & Classes, Definitions, References
  js/app.js                       routing (#/catalog, #/tonight, #/my, #/info/<page>), theme, start-up
  astro.js                        sky calculations (replaces the workbook's VBA AstroFunctions)
  data.js                         generated catalogue + reference text
  thumbs/                         generated per-object thumbnails (~34 MB)
  vendor/astronomy-2.1.19.min.js  Astronomy Engine (MIT)
scripts/
  extract.py                      xlsm -> data.js, thumbs/, fixture.json (Python stdlib only)
  verify.mjs                      checks astro.js against the workbook's cached results
  fixture.json                    generated
```

## Rebuilding from a new edition of the workbook

```sh
python3 -I scripts/extract.py "Imm Deep Sky Compendium - 2026 - rev6b.xlsm" \
    --previous "Imm Deep Sky Compendium - 2023 - rev4g.xlsm"
node scripts/verify.mjs
```

`extract.py` reads the row range from the sheet's filter range and finds the columns that move between editions (catalogues, SIMBAD key, Aladin FOV, feature codes, transit sort, azimuth) from the header rows, so it handles both the 2023 and 2026 layouts. It prints what it found; a catalogue header it doesn't recognise is named from its header note and reported. Columns A–AH are assumed fixed.

New catalogue columns show up in the app automatically. If a new edition adds a filter button or an "Other filters" dropdown entry, add it to `PRESET_GROUPS` or `SPECIAL` in `web/js/config.js`; a friendlier label for a new catalogue goes in `CATALOG_LABEL` there.

`--previous` (optional) names the edition users may have saved data against. Objects renamed or corrected since then (e.g. `WR 16` → `WR 016`, `NGC 2422` → `NGC 2423`) are matched by position, then by shared designation, and the app moves saved priority / status / notes to the new names on load. The workbook's own "Sort to v4g" column isn't used for this because it is offset in places.

## How it maps to the workbook

| Workbook | Web app |
|---|---|
| Date/time cell, Now / Sunset buttons, spinners | Tonight panel: date/time field, Now / Sunset / Live, − / + stepper in 10 m, 1 h, 1 d or 1 mo steps |
| Lat/Long D-M-S, GMT offset, DST | Lat/Long (decimal or "d m s"), *Use my location*, time zone (device by default) |
| Sun & Moon blocks, moon phase pictures | Sun & Moon panel with a drawn phase |
| Alt. next 6 hrs, Transit, Max alt, Moon separation, Moon index (colour scales) | Same columns, same colour thresholds; Transit sort and A–Z sort |
| ~70 filter macros, Catalog and Other-filter dropdowns, Top 2/10/25 %, Dec/Size ranges | Filter sidebar with the same filters and Excel AutoFilter rules; Top Targets stack on the others |
| *My* priority / status / notes columns | *My plan* in each object's card; saved in this browser; *My list* page with export/import as JSON |
| User Guide, Type-Subtype-Class, Definitions, References tabs | Info pages |

Layout: on desktop, a filter sidebar, a collapsible *Tonight* panel (time, location, sun and moon) opened from the date button in the top bar, and the list as a table or cards. Tablets get the filters as a slide-over drawer. Phones get cards, a bottom sheet for filters, and a bottom bar with Catalog, Tonight, My list and Info.

Additions: text search across names, nicknames, catalogue numbers and notes (press `/`); removable chips for the active filters; constellation, "altitude in next 6 h", and *My status* filters; a *My list* page with counts and backup; previous / next in the object card (← / →) and links to objects (`#/object/m-031`); a column chooser; light / dark / night-vision red themes.

## Accuracy notes

`node scripts/verify.mjs` compares against the values the workbook last calculated (6th edition: 2026-10-14 18:49, 31° N 95° W):

- Sun times, moonrise/set: within about 1 minute. Object altitudes: within 0.35°.
- Azimuth (new in the 6th edition): the workbook uses unprecessed J2000 coordinates, so it is off by ~0.35° on the sky (more in degrees of azimuth near the zenith); the app precesses to the current date.
- Transit times differ from the workbook by 3–8 minutes because the workbook computes transit for the *previous* day and skips precession; the app's values match Astronomy Engine's own transit search to 0.05 minutes.
- Moon illumination and age are computed directly. The workbook interpolates a coarse table (66.6 % / 20.6 d vs the true 70 % / 20.0 d at the reference time), so the moon index differs slightly.
- Three workbook rows have wrong decimal RA/Dec cells in both editions (NGC 4526, NGC 5985, NGC 7094). The app decodes the hms/dms source columns instead.
- In the 6th edition, NGC 5749's NGC catalogue column still reads 5822 (left over from a duplicate NGC 5822 row in the 2023 edition).
- The workbook's PN "Elliptical" button runs the galaxy Elliptical macro; the app uses the intended PN filter.

## Publishing (GitHub Pages)

Live at <https://markcheno.github.io/imm-compendium/>. `.github/workflows/pages.yml` uploads `web/` (a self-contained static site with relative paths) and deploys it on every push to `main` that touches `web/`; run it by hand from the Actions tab with *Run workflow*. The repository's Pages source is set to *GitHub Actions*. The thumbnails add ~34 MB and 3,144 files.

Publishing makes Gary Imm's data and ~3,100 of his images public. He distributes the workbook free and invites contact (see the *About* tab), so ask his permission before putting it online. The app credits him in the header, an *About* tab, each object's image caption, and the footer.

## Credits

- Imm Deep Sky Compendium data, text and images: © Gary Imm — <https://www.astrobin.com/users/GaryI/>
- Sky calculations: [Astronomy Engine](https://github.com/cosinekitty/astronomy) by Don Cross (MIT), vendored in `web/vendor/`
