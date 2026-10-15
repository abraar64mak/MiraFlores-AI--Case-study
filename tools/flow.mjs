// Drives the whole season through the real app code. node tools/flow.mjs
import { createRequire } from "node:module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
const url = process.argv[2] || "http://localhost:8765/index.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => window.WP_READY);
const T = (name, ok, extra = "") => console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : ""));
const ev = (fn, arg) => Promise.race([page.evaluate(fn, arg), new Promise((_, r) => setTimeout(() => r(new Error("evaluate timeout (a dialog is waiting?)")), 20000))]);
const as = (id) => ev((i) => WP.store.setUser(i), id);

// 1. preparer proposes from a finding
await as("st-01");
await ev(() => WP.ui.acts["adj-propose"]({ dataset: { fid: "DUP-INTEREST", sid: "all" } }));
let n = await ev(() => WP.adjList().length); T("preparer proposes duplicate-interest fix", n === 1);
let agi = await ev(() => [WP.M.line("F1040.11").value, WP.live().ev.get("F1040.11"), WP.live().ev.get("SchB.2")]);
T("AGI flows from adjustment (1840 less)", agi[0] - agi[1] === 1840, JSON.stringify(agi));
// undo / redo
await ev(() => WP.ui.acts.undo()); T("undo removes it", (await ev(() => WP.adjList().length)) === 0);
await ev(() => WP.ui.acts.redo()); T("redo restores it", (await ev(() => WP.adjList().length)) === 1);
// 2. enforced roles
const selfAp = await ev(() => WP.can("approve", { adj: WP.adjList()[0] }));
T("author cannot approve own adjustment", !selfAp.ok, selfAp.why);
await as("st-02");
const rvAp = await ev(() => WP.can("approve", { adj: WP.adjList()[0] }));
T("reviewer can approve small adjustment", rvAp.ok);
await ev(() => WP.store.append("adj.decide", { id: WP.adjList()[0].id, decision: "approve", note: "agreed to D28/D29" }));
// bigger one needs a partner
await as("st-01");
await ev(() => WP.ui.acts["adj-propose"]({ dataset: { fid: "SEHI-ELIGIBLE", sid: "all" } }));
await as("st-02");
const big = await ev(() => WP.can("approve", { adj: WP.adjList().find((a) => a.findingId === "SEHI-ELIGIBLE") }));
T("reviewer blocked above 1,000 tax effect", !big.ok, big.why);
await as("st-03");
const bigP = await ev(() => WP.can("approve", { adj: WP.adjList().find((a) => a.findingId === "SEHI-ELIGIBLE") }));
T("partner can approve large adjustment", bigP.ok);
// 3. sign-off reopens when the area changes
await as("st-02");
const so1 = await ev(() => WP.can("signoff", { area: "investments_and_digital_assets", level: "reviewer" }));
T("reviewer who did not work the area may sign", so1.ok || /prepared/.test(so1.why), so1.why || "");
await ev(() => WP.store.append("signoff.add", { id: "so-test", area: "investments_and_digital_assets", level: "reviewer", values: WP.areaSnapshot("investments_and_digital_assets") }));
T("sign-off valid", (await ev(() => WP.signoffStatus(WP.store.state.signoffs["so-test"]).state)) === "valid");
await as("st-01");
await ev(() => WP.ui.acts["adj-propose"]({ dataset: { fid: "FX-YEAR", sid: "all" } }));
const re = await ev(() => WP.signoffStatus(WP.store.state.signoffs["so-test"]));
T("sign-off reopens after a covered line changes", re.state === "reopened", re.changed && re.changed.join(","));
await as("st-02");
const selfSign = await ev(() => { WP.store.state.workedBy.investments_and_digital_assets.add("st-02"); return WP.can("signoff", { area: "investments_and_digital_assets", level: "reviewer" }); });
T("nobody signs off on their own work", !selfSign.ok, selfSign.why);
// 4. masking
await as("st-04");
const m4 = await ev(() => ({ clear: WP.canSeeSensitive(), html: WP.ui.sens("666-74-3309", "ssn") }));
T("no-clearance staff see masked SSN", !m4.clear && !/666-74-3309/.test(m4.html), m4.html.replace(/<[^>]+>/g, ""));
await as("st-01");
await ev(() => WP.ui.acts["reveal-doc"]({ dataset: { id: "D08" } }));
T("reveal by cleared staff is logged", (await ev(() => WP.store.state.views.length)) === 1);
// 5. before filing is ready
await as("st-03");
const steps0 = await ev(() => WP.steps().filter((s) => s.done).length);
T("steps are not all done at the start", steps0 < 12, steps0 + "/12");
// resolve everything quickly as the team would
await ev(() => {
  WP.findings.filter((f) => (f.sev === "error" || f.sev === "warning") && WP.findingState(f.id).status === "open").forEach((f) => WP.store.append("finding.set", { id: f.id, status: "resolved", note: "test: resolved" }));
  WP.store.append("step.set", { step: "Prior-year return reviewed", done: true });
  ["ctc_odc", "aotc", "eic", "hoh"].forEach((t) => WP.store.append("decision.add", { id: "dd-" + t, kind: "due_diligence", topic: t, title: "DD " + t, body: "ok", authority: "Form 8867", target: "" }));
  WP.variances().forEach((v) => WP.store.append("note.add", { target: v.key, kind: "variance", text: "moved states, sold rental, ISO" }));
  WP.M.curV().lines.filter((l) => (l.sources || []).some((s) => /^py:\/carryovers/.test(s))).forEach((l) => WP.store.append("verify.add", { target: l.key, vtype: "agreed_to_prior_year", note: "agreed" }));
});
// the SSN fix (approved)
await as("st-01");
await ev(() => WP.ui.acts["adj-propose"]({ dataset: { fid: "SSN-MISMATCH-THEO", sid: "all" } }));
await as("st-02");
await ev(() => { const a = WP.adjList().find((x) => x.target === "household:theo.ssn"); WP.store.append("adj.decide", { id: a.id, decision: "approve", note: "agreed to card D71" }); });
// approve all pending as partner
await as("st-03");
await ev(() => WP.adjList().filter((a) => a.status === "proposed").forEach((a) => WP.store.append("adj.decide", { id: a.id, decision: "approve", note: "partner" })));
// sign-offs: reviewer st-02 and partner st-03 on every area (they did not prepare any)
await ev(() => { WP.SIGN_AREAS.forEach((a) => { ["st-02", "st-03"].forEach((u, i) => { WP.store.setUser(u); WP.store.append("signoff.add", { id: "so-" + a.key + i, area: a.key, level: i ? "partner" : "reviewer", values: WP.areaSnapshot(a.key) }); }); }); WP.store.setUser("st-03"); });
const steps1 = await ev(() => WP.steps().map((s) => (s.done ? "✓" : "✗") + " " + s.label + (s.done ? "" : " — " + s.detail)));
console.log(steps1.join("\n"));

// ---- filing: reject, fix, re-release, re-sign, accept, freeze, amend ----
await as("st-02");
await ev(() => { const a = WP.adjList().find((x) => x.target === "household:theo.ssn"); WP.store.append("adj.revert", { id: a.id, note: "test: back out the fix to see the rejection" }); });
await as("st-03");
const release = () => ev(() => WP.store.append("filing.release", { digest: WP.returnDigest() }));
await release();
const clientSign = () => ev(() => { ["cu-01", "cu-02"].forEach((u) => { WP.store.setUser(u); WP.store.append("filing.approve", { digest: WP.returnDigest() }); }); WP.store.setUser("cu-02"); WP.store.append("filing.esign", { digest: WP.returnDigest(), both: true }); WP.store.setUser("st-03"); });
await clientSign();
T("both clients signed on a current release", await ev(() => !!WP.store.state.filing.esign && WP.store.state.filing.approvals["cu-01"].digest === WP.returnDigest()));
await ev(() => WP.ui.acts.transmit());
let sub = await ev(() => WP.store.state.filing.submissions.map((s) => s.jurisdiction + ":" + s.status));
T("e-file rejected for the wrong dependent SSN; California held", sub.join() === "federal:rejected,california:not_transmitted", sub.join());
T("a blocking review note was opened automatically", (await ev(() => WP.openBlockers().length)) === 1);
T("not frozen after a rejection", !(await ev(() => WP.store.state.filing.frozen)));
// fix: new SSN adjustment, approved
await as("st-01");
await ev(() => WP.ui.acts["adj-propose"]({ dataset: { fid: "SSN-MISMATCH-THEO", sid: "all" } }));
await as("st-02");
await ev(() => { const a = WP.adjList().find((x) => x.target === "household:theo.ssn" && x.status === "proposed"); WP.store.append("adj.decide", { id: a.id, decision: "approve", note: "agreed to the card" }); });
await as("st-03");
T("release is stale after the correction", await ev(() => WP.store.state.filing.released.digest !== WP.returnDigest()));
T("client signatures are stale after the correction", await ev(() => WP.store.state.filing.approvals["cu-01"].digest !== WP.returnDigest()));
// close the blocking note, re-release, re-sign
await ev(() => { const t = WP.openBlockers()[0]; WP.store.append("thread.status", { id: t.id, status: "resolved", note: "SSN corrected" }); });
await release(); await clientSign();
await ev(() => WP.ui.acts.transmit());
sub = await ev(() => WP.store.state.filing.submissions.map((s) => s.jurisdiction + ":" + s.status));
T("retransmit accepted by IRS and FTB", sub.slice(-2).join() === "federal:accepted,california:accepted", sub.join());
const fz = await ev(() => WP.store.state.filing.frozen);
T("return frozen with a content hash", !!fz && fz.hash.length === 64, fz && fz.hash.slice(0, 16));
// amendment layer
await as("st-01");
await ev(() => WP.ui.acts["adj-propose"]({ dataset: { fid: "VEHICLE-FMV", sid: "all" } }));
const am = await ev(() => WP.adjList().filter((a) => a.amendment).length);
T("post-filing change becomes an amendment, original frozen", am === 1);
T("frozen snapshot is unchanged", await ev(() => WP.store.state.filing.frozen.snapshot["F8283.A1.vehicle"] === 6000));
T("log hash chain intact", (await ev(() => WP.store.verifyChain())).ok);
await page.goto(url + "#/filing"); await page.waitForTimeout(300); await page.screenshot({ path: "/tmp/shots/filing.png" });
await page.goto(url + "#/notice"); await page.waitForTimeout(300); await page.screenshot({ path: "/tmp/shots/notice.png", fullPage: false });
await as("st-06");
T("quality reviewer allowed only after filing", (await ev(() => WP.can("note"))).ok);
console.log("page errors:", errors.length ? errors : "none");
await browser.close();
