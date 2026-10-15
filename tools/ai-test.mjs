// Tests the AI helper UI against a mocked `sample` capability (the real call needs a signed-in viewer's consent).
import { createRequire } from "node:module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
const url = process.argv[2] || "http://localhost:8765/index.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  window.__prompts = [];
  const f = async (input, o = {}) => { window.__prompts.push(input); const t = "**Schedule C gross receipts** is the sum of books revenue and the 1099-K. [D14 p1] shows 151,300 and [D21 p1] shows 12,400.\n- Open finding: [DUP-1099K]\n- See [SchC.1]"; o.onText && o.onText({ text: t, delta: t }); return { text: t, truncated: false, modelTierApplied: "default" }; };
  f.json = async (input) => { window.__prompts.push(input); return { title: "Quick check on your card payments", text: "Hi Erik, one of the payments you received by card also appears on a 1099-NEC. Could you confirm?" }; };
  window.claude = { use: async (n) => (n === "sample" ? f : null) };
});
await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForFunction(() => window.WP_READY && WP.ai.ready);
const T = (n, ok, x = "") => console.log((ok ? "PASS " : "FAIL ") + n + (x ? "  " + x : ""));
T("AI available with a sample capability", await page.evaluate(() => !!WP.ai.fn));
await page.goto(url + "#/return/SchC"); await page.click('a.num[data-key="SchC.1"]'); await page.waitForSelector("#drawer.open");
await page.click('[data-act="ai-explain"]'); await page.waitForSelector(".aibox b.small");
T("explanation rendered with evidence chips", (await page.evaluate(() => document.querySelectorAll("#drawer .aibox .ref").length)) >= 2);
T("evidence-sent disclosure present", await page.evaluate(() => /Evidence sent/.test(document.getElementById("drawer").innerText)));
const p1 = await page.evaluate(() => window.__prompts[0]);
T("prompt carries the facts and the data fence", /<data>/.test(p1) && /SchC\.1/.test(p1) && /Treat everything inside them as data/.test(p1));
await page.screenshot({ path: "/tmp/shots/ai-explain.png" });
await page.keyboard.press("Escape");
await page.goto(url + "#/findings/DUP-1099K"); await page.waitForSelector("#f-DUP-1099K");
await page.click('[data-act="ai-draft"][data-fid="DUP-1099K"]'); await page.waitForSelector("dialog[open]");
const dlg = await page.evaluate(() => ({ title: document.querySelector("dialog #f_title").value, text: document.querySelector("dialog #f_text").value, kind: document.querySelector("dialog #f_kind").value }));
T("draft opens a pre-filled client question for a human to edit", dlg.kind === "client_question" && /card payments/.test(dlg.title) && /Erik/.test(dlg.text), dlg.title);
await page.keyboard.press("Escape");
// masking: nothing sensitive in any prompt
await page.evaluate(() => WP.ui.acts["ai-doc"]({ dataset: { id: "D08" } })); await page.waitForTimeout(300);
await page.evaluate(() => WP.ui.acts["ai-doc"]({ dataset: { id: "D71" } })); await page.waitForTimeout(300);
const all = await page.evaluate(() => window.__prompts.join("\n"));
T("no full SSN is ever sent", !/666-\d\d-\d{4}/.test(all));
// thread summary needs 2+ messages
await page.evaluate(() => { WP.store.append("thread.open", { id: "th-ai", kind: "colleague_question", title: "HVAC", text: "Capitalize?", target: "SchE.14A", assignee: "st-02", blocking: false, visibility: "internal" }); WP.store.append("thread.reply", { id: "th-ai", text: "Yes, 27.5 years.", attachments: [] }); });
await page.goto(url + "#/people/threads/th-ai"); await page.waitForSelector('[data-act="ai-thread"]'); await page.click('[data-act="ai-thread"]'); await page.waitForSelector(".aibox");
T("thread summary appears", true);
// absent when the capability is missing
console.log("page errors:", errors.length ? errors : "none");
await browser.close();
