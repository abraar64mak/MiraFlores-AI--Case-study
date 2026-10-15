// Headless smoke test for the logic layer (no DOM). Run: node tools/logic-test.mjs
import fs from "node:fs";
import vm from "node:vm";
const store = {};
const ctx = {
  console, TextEncoder, setInterval: () => 0, setTimeout: () => 0, clearTimeout() {}, BroadcastChannel: undefined,
  localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v) },
  sessionStorage: { getItem: () => null, setItem() {} },
  addEventListener() {}, location: { hash: "" },
};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ["util", "model", "store", "domain", "checks"]) vm.runInContext(fs.readFileSync(`js/${f}.js`, "utf8"), ctx, { filename: f });
const raw = fs.readFileSync("data/packet.json", "utf8");
const P = JSON.parse(raw);
const { WP } = ctx;
// sha256 sanity
console.log("sha256('abc') =", WP.U.sha256("abc") === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" ? "OK" : "WRONG " + WP.U.sha256("abc"));
WP.buildModel(P); WP.initUsers(P); WP.store.load(); WP.store.packetHash = WP.U.sha256(raw).slice(0, 16);
WP.runChecks(); WP.store.ensureGenesis();
const M = WP.M;
// ops inference: does evaluate reproduce the originals with no adjustments?
const ev = M.evaluate("v3", []);
let bad = 0; M.curV().lines.forEach((l) => { if (ev.get(l.key) !== l.value) bad++; });
console.log("evaluate() identity mismatches:", bad, " ops inferred:", Object.keys(M.curV().ops).length);
console.log("findings:", WP.findings.length);
for (const f of WP.findings) console.log(f.sev.padEnd(7), f.id.padEnd(22), "fed", Math.round(f.effect.fed), "ca", Math.round(f.effect.ca), "|", f.title.slice(0, 80));
// apply every suggestion and look at totals + chain
const adjs = [];
WP.findings.forEach((f) => (f.suggest || []).forEach((s) => adjs.push({ ...s, id: f.id + s.sid })));
const lineAdjs = adjs.filter((a) => M.line(a.target));
const e2 = M.evaluate("v3", lineAdjs);
console.log("AGI before/after:", M.line("F1040.11").value, e2.get("F1040.11"), " SchC.31:", M.line("SchC.31").value, e2.get("SchC.31"), " SchB.2:", M.line("SchB.2").value, e2.get("SchB.2"));
console.log("totals:", JSON.stringify(M.totals(adjs).federal), JSON.stringify(M.totals(adjs).california));
console.log("variances:", WP.variances().length, WP.variances().slice(0, 4).map((v) => v.key + " " + v.py + "→" + v.cur));
console.log("docs w/o disposition:", M.docs.filter((d) => !WP.docDisposition(d.id)).length, " flags:", JSON.stringify(WP.docFlags));
const seg = M.pageSegments("D08", 1); console.log("D08 p1 highlighted:", seg.segs.filter((s) => s.ev).length, "unlocated:", seg.unlocated.length);
let tot = 0, un = 0; M.docs.forEach((d) => d.pages.forEach((p) => { const s = M.pageSegments(d.id, p.page); tot += s.segs.filter((x) => x.ev).length; un += s.unlocated.length; }));
console.log("highlight coverage over all docs: located", tot, "unlocated", un);
console.log("chain verify:", JSON.stringify(WP.store.verifyChain()), " steps done:", WP.steps().filter((s) => s.done).length + "/" + WP.steps().length);
process.exit(0);
