import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
const url = process.argv[3] || "http://localhost:8765/index.html";
const dir = process.argv[2] || "/tmp/shots"; fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForFunction(() => window.WP_READY);
await page.evaluate(() => { WP.ui.confirm = async () => true; return WP.ui.acts["demo-seed"](); }); await page.waitForTimeout(400);
const as = (u) => page.evaluate((id) => WP.store.setUser(id), u);
for (const [u, n] of [["st-01","preparer"],["st-02","reviewer"],["st-03","partner"],["st-05","admin"],["cu-01","client"]]) { await as(u); await page.goto(url + "#/overview"); await page.waitForTimeout(500); await page.screenshot({ path: `${dir}/home-${n}.png` }); }
await as("st-01");
await page.goto(url + "#/findings"); await page.waitForTimeout(400); await page.screenshot({ path: `${dir}/findings.png` });
await page.keyboard.press("Control+k"); await page.waitForTimeout(200); await page.keyboard.type("mile"); await page.waitForTimeout(250); await page.screenshot({ path: `${dir}/cmdk.png` }); await page.keyboard.press("Escape");
await page.goto(url + "#/return/SchC"); await page.waitForTimeout(300); await page.click('a.num[data-key="SchC.1"]'); await page.waitForTimeout(500); await page.screenshot({ path: `${dir}/trace.png` });
await page.setViewportSize({ width: 400, height: 800 }); await page.goto(url + "#/overview"); await page.waitForTimeout(400); await page.screenshot({ path: `${dir}/mobile.png` });
await browser.close();
