/* Utilities: formatting, escaping, hashing. No dependencies. */
window.WP = window.WP || {};
(function () {
  const U = (WP.U = {});

  U.esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  U.money = (n, o = {}) => {
    if (n === null || n === undefined || n === "") return "—";
    if (typeof n !== "number") return String(n);
    const dec = o.dec ?? 0;
    const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const s = n < 0 ? `(${abs})` : abs;
    return o.sign && n > 0 ? "+" + s : s;
  };
  U.signed = (n, dec = 0) => (n > 0 ? "+" : "") + U.money(n, { dec });
  U.pct = (n, d = 1) => (n === null || n === undefined || !isFinite(n) ? "—" : (n * 100).toFixed(d) + "%");
  U.date = (iso) => (iso ? String(iso).slice(0, 10) : "—");
  U.dt = (iso) => (iso ? new Date(iso).toISOString().replace("T", " ").slice(0, 16) + "Z" : "—");
  U.uid = (p = "x") => p + "-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  U.clone = (x) => JSON.parse(JSON.stringify(x));
  U.sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
  U.round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
  U.isNum = (x) => typeof x === "number" && isFinite(x);

  /* Stable stringify so hashes do not depend on key order. */
  U.stable = (x) => {
    if (x === null || typeof x !== "object") return JSON.stringify(x);
    if (Array.isArray(x)) return "[" + x.map(U.stable).join(",") + "]";
    return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + U.stable(x[k])).join(",") + "}";
  };

  /* Synchronous SHA-256 (the event log chains hashes on every append). */
  const K = [], H0 = [];
  (function init() {
    let n = 2, c = 0;
    while (c < 64) {
      let prime = true;
      for (let i = 2; i * i <= n; i++) if (n % i === 0) { prime = false; break; }
      if (prime) {
        if (c < 8) H0.push(((Math.pow(n, 1 / 2) % 1) * 4294967296) | 0);
        K.push(((Math.pow(n, 1 / 3) % 1) * 4294967296) | 0);
        c++;
      }
      n++;
    }
  })();
  const rr = (n, x) => (x >>> n) | (x << (32 - n));
  U.sha256 = (msg) => {
    const bytes = new TextEncoder().encode(msg);
    const l = bytes.length, nb = ((l + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(nb);
    buf.set(bytes);
    buf[l] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(nb - 8, Math.floor((l * 8) / 4294967296));
    dv.setUint32(nb - 4, (l * 8) >>> 0);
    let h = H0.slice();
    const w = new Int32Array(64);
    for (let o = 0; o < nb; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getInt32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        const s0 = rr(7, a) ^ rr(18, a) ^ (a >>> 3), s1 = rr(17, b) ^ rr(19, b) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rr(6, e) ^ rr(11, e) ^ rr(25, e), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rr(2, a) ^ rr(13, a) ^ rr(22, a), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h = [(h[0] + a) | 0, (h[1] + b) | 0, (h[2] + c) | 0, (h[3] + d) | 0, (h[4] + e) | 0, (h[5] + f) | 0, (h[6] + g) | 0, (h[7] + hh) | 0];
    }
    return h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  };
  U.short = (hash) => (hash ? hash.slice(0, 8) : "");

  U.debounce = (fn, ms) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  /* Sensitive values: SSNs, account numbers, IP PINs. */
  U.maskSsn = (s) => (s ? "•••-••-" + String(s).slice(-4) : "");
  U.maskAcct = (s) => (s ? "••••" + String(s).slice(-4) : "");
})();
