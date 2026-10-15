// Bundles the app into one self-contained HTML file (packet embedded as delivered). node tools/build-single.mjs
import fs from "node:fs";
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("css/app.css", "utf8");
const packet = fs.readFileSync("data/packet.json", "utf8").replace(/<\//g, "<\\/");
let out = html.replace(/<link rel="stylesheet" href="css\/app.css">/, () => `<style>\n${css}\n</style>`);
out = out.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, p) => `<script>\n${fs.readFileSync(p, "utf8").replace(/<\/script>/g, "<\\/script>")}\n</script>`);
out = out.replace("</body>", () => `<script type="application/json" id="packet-data">${packet}</script>\n</body>`);
// the packet must be in the DOM before app.js runs: move app.js after the data block
const appTag = out.match(/<script>\n\/\* Boot:[\s\S]*?<\/script>\n/)[0];
out = out.replace(appTag, "").replace("</body>", () => appTag + "</body>");
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/workpaper.html", out);
// GitHub Pages can also publish the /docs folder, so ship the same self-contained app there as its index.
fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/index.html", out);
console.log("dist/workpaper.html", (out.length / 1e6).toFixed(2), "MB");
