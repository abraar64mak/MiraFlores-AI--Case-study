// Builds blog/index.html from docs/BLOG.md (single source of truth). Needs pandoc. node tools/build-blog.mjs
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const md = fs.readFileSync("docs/BLOG.md", "utf8");
const words = md.split(/\s+/).length;
const minutes = Math.max(1, Math.round(words / 200));
let html = execFileSync("pandoc", ["-f", "gfm", "-t", "html", "--wrap=none"], { input: md }).toString();

const title = (/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html) || [, "Blog"])[1].replace(/<[^>]+>/g, "");
html = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/, "");
html = html.replace(/<p>\s*Live site:[\s\S]*?<\/p>/, ""); // shown in the header buttons instead

const parts = html.split(/(?=<h2 id=")/);
const intro = parts.shift();
const toc = [];
const sections = parts.map((chunk) => {
  const m = /<h2 id="([^"]+)">([\s\S]*?)<\/h2>/.exec(chunk);
  const id = m[1], text = m[2].replace(/<[^>]+>/g, "");
  const step = /^Step (\d+):\s*(.*)$/.exec(text);
  const label = step ? step[2] : text;
  toc.push({ id, label, n: step ? step[1] : "" });
  const head = `<h2 id="${id}">${step ? `<span class="n">${step[1]}</span>` : ""}<span>${label}</span></h2>`;
  return `<section class="post-sec${step ? "" : " plain"}" aria-labelledby="${id}">${chunk.replace(m[0], head)}</section>`;
});

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="A first-person account of how I approached the Miraflores tax workpaper case study: the brief, the data, the research, the design and the build.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap">
<style>
:root { --bg: #f5f7fb; --panel: #ffffff; --ink: #121a2b; --muted: #596277; --line: #dfe4ee; --accent: #3550e6; --accent-ink: #ffffff; --accent-soft: #e5eaff; --hero-a: #101a3d; --hero-b: #2c42bd; --code: #eef1f8;
  --sans: "Manrope", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; --mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #0b0f1a; --panel: #121929; --ink: #e8ecf5; --muted: #99a3ba; --line: #232c42; --accent: #8ba0ff; --accent-ink: #0a0f22; --accent-soft: #1b2552; --hero-a: #0b1230; --hero-b: #26379b; --code: #1a2236; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #0b0f1a; --panel: #121929; --ink: #e8ecf5; --muted: #99a3ba; --line: #232c42; --accent: #8ba0ff; --accent-ink: #0a0f22; --accent-soft: #1b2552; --hero-a: #0b1230; --hero-b: #26379b; --code: #1a2236; color-scheme: dark; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 70px; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.75 var(--sans); -webkit-font-smoothing: antialiased; }
a { color: var(--accent); text-underline-offset: 3px; }
#bar { position: fixed; top: 0; left: 0; height: 3px; width: 0; background: var(--accent); z-index: 20; }
.top { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 14px; padding: 10px max(16px, 3vw); background: color-mix(in srgb, var(--bg) 86%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line); font-size: 14px; }
.top b { font-weight: 800; letter-spacing: -0.01em; } .top .sp { flex: 1; }
.top a.pill, .top button { font: inherit; font-weight: 600; text-decoration: none; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 6px 12px; cursor: pointer; }
.top a.pill:hover, .top button:hover { border-color: var(--accent); }
.hero { background: radial-gradient(900px 260px at 100% -30%, color-mix(in srgb, var(--hero-b) 90%, #fff 10%), transparent 60%), linear-gradient(135deg, var(--hero-a), var(--hero-b)); color: #fff; padding: 56px max(16px, 4vw) 48px; }
.hero .in { max-width: 1060px; margin: 0 auto; }
.eyebrow { font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255, 255, 255, 0.72); margin-bottom: 14px; }
.hero h1 { font-size: clamp(30px, 5vw, 50px); line-height: 1.08; letter-spacing: -0.03em; margin: 0 0 18px; font-weight: 800; max-width: 20ch; text-wrap: balance; }
.meta { display: flex; flex-wrap: wrap; gap: 8px 22px; color: rgba(255, 255, 255, 0.82); font-size: 15px; }
.meta b { color: #fff; font-weight: 700; }
.btns { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
.btns a { text-decoration: none; font-weight: 700; font-size: 14.5px; padding: 10px 18px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.34); color: #fff; background: rgba(255, 255, 255, 0.12); }
.btns a:first-child { background: #fff; color: #15204d; border-color: #fff; }
.btns a:hover { background: rgba(255, 255, 255, 0.24); } .btns a:first-child:hover { background: #eef1ff; }
.wrap { max-width: 1060px; margin: 0 auto; padding: 40px max(16px, 4vw) 90px; display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 56px; }
nav.toc { position: sticky; top: 76px; align-self: start; font-size: 14px; }
nav.toc h4 { margin: 0 0 10px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
nav.toc a { display: flex; gap: 10px; align-items: baseline; padding: 6px 10px; margin-left: -10px; border-radius: 8px; color: var(--muted); text-decoration: none; line-height: 1.35; }
nav.toc a .n { font: 600 12px var(--mono); color: var(--muted); min-width: 16px; }
nav.toc a:hover { color: var(--ink); background: var(--accent-soft); }
nav.toc a.on { color: var(--ink); background: var(--accent-soft); font-weight: 700; } nav.toc a.on .n { color: var(--accent); }
article { min-width: 0; max-width: 700px; }
article > p:first-child { font-size: 19px; color: var(--muted); margin-top: 0; }
.post-sec { padding-top: 6px; margin-bottom: 44px; }
.post-sec h2 { display: flex; gap: 14px; align-items: center; font-size: clamp(22px, 3vw, 28px); line-height: 1.25; letter-spacing: -0.02em; margin: 0 0 14px; font-weight: 800; }
.post-sec h2 .n { flex: none; width: 38px; height: 38px; border-radius: 12px; background: var(--accent); color: var(--accent-ink); display: grid; place-items: center; font: 700 16px var(--mono); }
.post-sec p { margin: 0 0 16px; }
.post-sec ul, .post-sec ol { margin: 0 0 18px; padding-left: 0; list-style: none; }
.post-sec li { position: relative; padding: 9px 14px 9px 38px; margin: 0 0 6px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; }
.post-sec ul li::before { content: ""; position: absolute; left: 15px; top: 20px; width: 9px; height: 9px; border-radius: 3px; background: var(--accent); }
.post-sec ol { counter-reset: s; } .post-sec ol li { counter-increment: s; }
.post-sec ol li::before { content: counter(s); position: absolute; left: 11px; top: 9px; width: 20px; height: 20px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); font: 700 12px var(--mono); display: grid; place-items: center; }
.post-sec li p { margin: 0; }
code { font: 0.86em var(--mono); background: var(--code); padding: 1px 6px; border-radius: 6px; }
strong { font-weight: 700; }
footer { border-top: 1px solid var(--line); padding: 28px max(16px, 4vw) 50px; color: var(--muted); font-size: 14.5px; }
footer .in { max-width: 1060px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 10px 26px; }
@media (max-width: 860px) { .wrap { grid-template-columns: minmax(0, 1fr); gap: 0; padding-top: 28px; } nav.toc { display: none; } body { font-size: 16.5px; } .hero { padding-top: 40px; } .top .hide-m { display: none; } }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
</style>
</head>
<body>
<div id="bar"></div>
<header class="top"><b>abraar64mak</b><span class="sp"></span><a class="pill hide-m" href="../">Live workpaper</a><a class="pill hide-m" href="https://github.com/abraar64mak/MiraFlores-AI--Case-study">Code</a><button id="theme" aria-label="Toggle light or dark">◐</button></header>
<div class="hero"><div class="in">
  <div class="eyebrow">Case study log · Miraflores tax workpaper</div>
  <h1>${esc(title)}</h1>
  <div class="meta"><span>By <b>abraar64mak</b></span><span>Assessment received <b>October 14, 2026</b></span><span>${minutes} min read</span></div>
  <div class="btns"><a href="../">Open the live workpaper</a><a href="https://github.com/abraar64mak/MiraFlores-AI--Case-study">View the code</a><a href="../docs/ONE_PAGER.pdf">One-pager (PDF)</a><a href="../docs/ERRORS_FOUND.pdf">Errors found (PDF)</a></div>
</div></div>
<div class="wrap">
  <nav class="toc" aria-label="Contents"><h4>In this post</h4>${toc.map((t) => `<a href="#${t.id}"><span class="n">${t.n || "·"}</span><span>${t.label}</span></a>`).join("")}</nav>
  <article>${intro}${sections.join("\n")}</article>
</div>
<footer><div class="in"><span>Written by abraar64mak.</span><a href="https://github.com/abraar64mak/MiraFlores-AI--Case-study/blob/claude/gifted-wright-vops7y/docs/AI_AND_TOOLS.md">How I used AI</a><a href="../">The workpaper</a><a href="https://github.com/abraar64mak/MiraFlores-AI--Case-study">Source on GitHub</a></div></footer>
<script>
(function () {
  var bar = document.getElementById("bar"), links = [].slice.call(document.querySelectorAll("nav.toc a")), secs = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
  function onScroll() {
    var h = document.documentElement, p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight); bar.style.width = (p * 100) + "%";
    var cur = 0; secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < 140) cur = i; });
    links.forEach(function (a, i) { a.classList.toggle("on", i === cur); });
  }
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  try { var t = localStorage.getItem("blog.theme"); if (t) document.documentElement.setAttribute("data-theme", t); } catch (e) {}
  document.getElementById("theme").addEventListener("click", function () {
    var r = document.documentElement, dark = r.getAttribute("data-theme") ? r.getAttribute("data-theme") === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    var n = dark ? "light" : "dark"; r.setAttribute("data-theme", n); try { localStorage.setItem("blog.theme", n); } catch (e) {}
  });
})();
</script>
</body>
</html>
`;
fs.mkdirSync("blog", { recursive: true });
fs.writeFileSync("blog/index.html", page);
console.log("blog/index.html", (page.length / 1000).toFixed(0), "KB,", sections.length, "sections,", minutes, "min read");
