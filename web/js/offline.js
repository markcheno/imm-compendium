// Offline support: registers the service worker (sw.js), offers a reload after an update,
// and lets the user save every thumbnail for use without signal (My list page).
(() => {
  "use strict";
  const Imm = window.Imm;
  const { $, OBJ } = Imm;

  const THUMBS = "imm-thumbs"; // must match sw.js
  const supported = "serviceWorker" in navigator && "caches" in window && /^https?:$/.test(location.protocol);
  const thumbUrls = OBJ.filter((o) => o.thumb).map((o) => new URL(o.thumb, location.href).href);
  let saving = false;

  const mb = (bytes) => `${(bytes / 1e6).toFixed(0)} MB`;

  async function savedCount() {
    const keys = await (await caches.open(THUMBS)).keys();
    const want = new Set(thumbUrls);
    return keys.filter((r) => want.has(r.url)).length;
  }

  async function renderStatus() {
    if (!supported) return;
    const n = await savedCount();
    const ready = !!navigator.serviceWorker.controller;
    let usage = "";
    try { const est = await navigator.storage.estimate(); usage = ` · ${mb(est.usage || 0)} used on this device`; } catch { /* not available */ }
    $("#offline-status").textContent = `${ready ? "The app itself works offline." : "Offline support is installing…"} ${n.toLocaleString()} of ${thumbUrls.length.toLocaleString()} images saved${usage}.`;
    if (!saving) {
      $("#btn-save-thumbs").textContent = n >= thumbUrls.length ? "All images saved" : n ? "Save the remaining images" : "Save all images (about 34 MB)";
      $("#btn-save-thumbs").disabled = n >= thumbUrls.length;
    }
    $("#btn-clear-thumbs").hidden = !n || saving;
  }

  async function saveAll() {
    if (saving) { saving = false; return; }
    saving = true;
    $("#btn-save-thumbs").textContent = "Stop";
    $("#btn-clear-thumbs").hidden = true;
    try { await navigator.storage?.persist?.(); } catch { /* best effort */ }
    const cache = await caches.open(THUMBS);
    const have = new Set((await cache.keys()).map((r) => r.url));
    const todo = thumbUrls.filter((u) => !have.has(u));
    let done = 0, failed = 0;
    const worker = async () => {
      while (saving && todo.length) {
        const url = todo.pop();
        try {
          const res = await fetch(url, { cache: "no-cache" });
          if (!res.ok) throw new Error(res.status);
          await cache.put(url, res);
        } catch { failed++; }
        done++;
        if (done % 25 === 0) $("#offline-status").textContent = `Saving images… ${done.toLocaleString()} of ${(done + todo.length).toLocaleString()}`;
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    const stopped = !saving;
    saving = false;
    await renderStatus();
    if (failed) $("#offline-status").textContent += ` ${failed} couldn't be downloaded; try again with a better connection.`;
    else if (stopped) $("#offline-status").textContent += " Stopped.";
  }

  Imm.initOffline = () => {
    if (!supported) return;
    $("#offline").hidden = false;
    $("#btn-save-thumbs").addEventListener("click", saveAll);
    $("#btn-clear-thumbs").addEventListener("click", async () => {
      await caches.delete(THUMBS);
      renderStatus();
    });
    Imm.on("view", (v) => { if (v === "my") renderStatus(); });

    // An update replaces the page's files underneath it; offer a reload rather than forcing one.
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController) $("#update-toast").hidden = false;
      hadController = true;
      renderStatus();
    });
    $("#btn-reload").addEventListener("click", () => location.reload());
    $("#btn-dismiss-update").addEventListener("click", () => { $("#update-toast").hidden = true; });

    navigator.serviceWorker.register("sw.js").catch(() => { /* offline support is optional */ });
  };
})();
