/* Boot: load the packet exactly as delivered, build the model, run the independent checks, render. */
(async function () {
  const ui = WP.ui;
  try { const t = localStorage.getItem("wp.theme"); if (t) document.documentElement.dataset.theme = t; else if (matchMedia("(prefers-color-scheme: dark)").matches) document.documentElement.dataset.theme = "dark"; } catch (e) {}
  const main = document.getElementById("main");
  main.innerHTML = `<div class="page"><div class="muted">Loading the packet…</div></div>`;
  let raw;
  const embedded = document.getElementById("packet-data");
  try {
    raw = embedded ? embedded.textContent : await (await fetch("data/packet.json")).text();
  } catch (e) {
    main.innerHTML = `<div class="page"><div class="callout err">Could not load data/packet.json (${e.message}). Serve this folder over http, for example <code>python3 -m http.server</code>.</div></div>`;
    return;
  }
  const P = JSON.parse(raw);
  WP.buildModel(P);
  WP.initUsers(P);
  WP.store.packetHash = WP.U.sha256(raw);
  WP.store.load();
  WP.runChecks();
  WP.store.ensureGenesis();
  WP.store.onChange(() => ui.rerender());
  ui.render();
  window.WP_READY = true;
})();
