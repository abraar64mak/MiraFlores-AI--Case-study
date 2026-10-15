// Page-content-only variant for publishing as a hosted artifact (the host adds the document skeleton).
// Drops controls the sandbox makes inert: print dialog and file downloads. node tools/build-single.mjs && node tools/build-artifact.mjs
import fs from "node:fs";
let h = fs.readFileSync("dist/workpaper.html", "utf8");
h = h.replace(/<button class="btn noprint" onclick="window\.print\(\)">[^<]*<\/button>/g, "");
h = h.replace(/<button class="btn" data-act="log-export">[^<]*<\/button>/g, "");
const title = (h.match(/<title>[^<]*<\/title>/) || ["<title>Okafor-Lindqvist Workpaper</title>"])[0];
const font = (h.match(/<link[^>]*fonts\.googleapis[^>]*>/) || [""])[0];
const style = h.match(/<style>[\s\S]*?<\/style>/)[0];
const body = h.slice(h.indexOf("<body>") + 6, h.lastIndexOf("</body>"));
fs.writeFileSync("dist/artifact.html", `${title}\n${font}\n${style}\n${body}`);
fs.writeFileSync("dist/artifact-test.html", `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${fs.readFileSync("dist/artifact.html", "utf8")}</body></html>`);
console.log("artifact.html", (fs.statSync("dist/artifact.html").size / 1e6).toFixed(2), "MB");
