import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const name = decodeURIComponent(
      url.pathname === "/" ? "/index.html" : url.pathname,
    );
    const path = resolve(join(root, name));
    if (!path.startsWith(root + "/") || !(await stat(path)).isFile())
      throw new Error("missing");
    res.writeHead(200, {
      "content-type": `${types[extname(path)] || "application/octet-stream"}; charset=utf-8`,
      "cache-control": "no-store",
    });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
}).listen(port, "0.0.0.0", () =>
  console.log(`Canvas Studio: http://localhost:${port}`),
);
