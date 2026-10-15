import { createRequire } from "node:module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
await page.goto("file://" + process.cwd() + "/dist/artifact-test.html"); await page.waitForFunction(() => window.WP_READY);
for (const r of ["overview", "findings", "records/sales", "people/threads"]) { await page.goto(page.url().split("#")[0] + "#/" + r); await page.waitForTimeout(250); const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); console.log(r, "scrollWidth/innerWidth", w.join("/")); }
await page.goto(page.url().split("#")[0] + "#/overview"); await page.waitForTimeout(250); await page.screenshot({ path: "/tmp/shots/mobile.png" });
await browser.close();
