import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 4173);

const CONTENT_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".map", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
]);

function getContentType(filePath) {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
}

function safeResolve(urlPath) {
  const pathname = decodeURIComponent(new URL(urlPath, "http://localhost").pathname);
  const relativePath = pathname === "/" ? "docs/migration/viewer.html" : pathname.slice(1);
  const absolutePath = path.resolve(ROOT, relativePath);
  const relativeToRoot = path.relative(ROOT, absolutePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return null;
  }
  return absolutePath;
}

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const filePath = safeResolve(request.url);
    if (!filePath) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        const indexPath = path.join(filePath, "index.html");
        const content = await fs.readFile(indexPath);
        return new Response(content, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      const content = await fs.readFile(filePath);
      return new Response(content, {
        headers: { "content-type": getContentType(filePath) },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  },
});

process.stdout.write(
  `Migration viewer server running at http://localhost:${server.port}/docs/migration/viewer.html\n`,
);
