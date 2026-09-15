import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import path from "node:path";
const root = path.resolve(fileURLToPath(new URL(".", import.meta.url))),
  port = Number(process.env.PORT || 5184),
  url = `http://localhost:${port}/index.html`,
  openWhenReady = process.argv.includes("--open");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
const openPreview = () => spawn("open", [url], { stdio: "ignore", detached: true }).unref();
http
  .createServer(async (req, res) => {
    try {
      const route = new URL(req.url, "http://localhost");
      if (route.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ app: "adaptive-medium-local-lab" }));
        return;
      }
      const p = path.resolve(root, "." + decodeURIComponent(route.pathname));
      if (p !== root && !p.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const target = (await stat(p)).isDirectory() ? path.join(p, "index.html") : p,
        data = await readFile(target);
      res.writeHead(200, {
        "Content-Type": types[path.extname(target)] || "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .on("error", async (e) => {
    if (e.code === "EADDRINUSE" && openWhenReady) {
      try {
        const existing = await fetch(`http://127.0.0.1:${port}/health`);
        if ((await existing.json()).app === "adaptive-medium-local-lab") {
          openPreview();
          return;
        }
      } catch {}
    }
    console.error(
      e.code === "EADDRINUSE"
        ? `Port ${port} is occupied. The existing application has not been stopped.`
        : e.message,
    );
    process.exitCode = 1;
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Adaptive Medium Lab: ${url}`);
    if (openWhenReady) openPreview();
  });
