// Headless browser walk-through. Usage: node tools/e2e.mjs [url]   (serve the folder first: python3 -m http.server 8765)
import { createRequire } from "node:module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
const url = process.argv[2] || "http://localhost:8765/index.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE " + m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.WP_READY, null, { timeout: 30000 });
const routes = ["records/recon", "records/complete", "overview", "findings", "findings/variances", "return", "return/F1040", "return/SchC", "return/F8949", "documents", "doc/D08", "doc/D23?p=3", "changes/ledger", "changes/compare", "changes/whatif", "changes/since", "people/threads", "people/signoffs", "people/team", "people/inbox", "filing", "clientcopy", "notice", "rollforward", "firm/standards", "firm/time", "firm/search?q=Halvorsen", "firm/viewlog", "firm/retention", "activity", "replay", ...["summary","tax","areas","docs","depr","sales","books","rentals","k1","retire","deduct","payments","state","carry","basis","prior"].map(t=>"records/"+t)];
for (const r of routes) {
  await page.goto(url + "#/" + r);
  await page.waitForTimeout(120);
  const bad = await page.evaluate(() => { const e = document.querySelector("#main .callout.err"); return e ? e.textContent : null; });
  const len = await page.evaluate(() => document.getElementById("main").innerText.length);
  console.log(bad ? "FAIL" : "ok  ", r.padEnd(26), len, bad || "");
}
// every role's home, nav and palette
for (const [u, name] of [["st-01","preparer"],["st-02","reviewer"],["st-03","partner"],["st-05","admin"],["st-06","qa"],["cu-01","client"]]) {
  await page.evaluate((id) => WP.store.setUser(id), u);
  await page.goto(url + "#/overview"); await page.waitForTimeout(150);
  const info = await page.evaluate(() => ({ nav: [...document.querySelectorAll("#nav a")].map((a) => a.textContent.trim().replace(/\s+/g, " ")).join(" | "), hero: (document.querySelector(".hero h1") || {}).textContent, err: !!document.querySelector("#main .callout.err") }));
  console.log(info.err ? "FAIL" : "ok  ", ("home:" + name).padEnd(26), info.hero, "||", info.nav.slice(0, 110));
}
await page.evaluate(() => WP.store.setUser("st-01"));
await page.keyboard.press("Control+k"); await page.waitForSelector("#cmdk.on"); await page.keyboard.type("mileage"); await page.waitForTimeout(150);
console.log("palette results for 'mileage':", await page.evaluate(() => document.querySelectorAll(".cmdk-it").length)); await page.keyboard.press("Escape");
// open a trace drawer
await page.goto(url + "#/return/F1040");
await page.click('a.num[data-key="F1040.1a"]');
await page.waitForSelector("#drawer.open", { timeout: 4000 }).catch(() => console.log("DRAWER DID NOT OPEN", errors));
console.log("trace drawer text length", await page.evaluate(() => document.getElementById("drawer").innerText.length));
await page.screenshot({ path: process.env.SHOT || "/tmp/trace.png" });
console.log("errors:", errors.length ? errors : "none");
await browser.close();
