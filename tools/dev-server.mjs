// Local server: static files plus /api/ai (the same handler Vercel runs). Usage:
//   ANTHROPIC_API_KEY=sk-ant-... node tools/dev-server.mjs [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const port = Number(process.argv[2] || process.env.PORT || 8000);
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".md": "text/plain" };
const { default: handler } = await import("../api/ai.js");
const wrap = (res) => { res.status = (c) => { res.statusCode = c; return res; }; res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); return res; }; return res; };
export const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/ai") {
    let raw = ""; for await (const c of req) raw += c;
    try { req.body = raw ? JSON.parse(raw) : undefined; } catch { req.body = undefined; }
    return handler(req, wrap(res));
  }
  let p = path.join(root, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("Content-Type", types[path.extname(p)] || "application/octet-stream"); fs.createReadStream(p).pipe(res);
});
if (process.argv[1] && process.argv[1].endsWith("dev-server.mjs")) server.listen(port, () => console.log(`http://localhost:${port}  (AI ${process.env.ANTHROPIC_API_KEY ? "enabled" : "disabled: set ANTHROPIC_API_KEY"})`));
