import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");
const indexPath = path.join(distDir, "index.html");
const port = Number(process.env.PORT || 3000);
const host = "0.0.0.0";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const sendFile = async (res, filePath, cacheControl) => {
  const extension = path.extname(filePath).toLowerCase();
  const contentType =
    contentTypes.get(extension) || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
  });

  createReadStream(filePath).pipe(res);
};

const sendIndex = async (res) => {
  await sendFile(res, indexPath, "no-store");
};

const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const requestPath =
      requestUrl.pathname === "/"
        ? "/index.html"
        : decodeURIComponent(requestUrl.pathname);
    const absolutePath = path.normalize(path.join(distDir, requestPath));

    if (!absolutePath.startsWith(distDir)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    let filePath = absolutePath;
    let fileStats;

    try {
      fileStats = await stat(filePath);
      if (fileStats.isDirectory()) {
        filePath = path.join(filePath, "index.html");
        fileStats = await stat(filePath);
      }
    } catch {
      await sendIndex(res);
      return;
    }

    if (!fileStats.isFile()) {
      await sendIndex(res);
      return;
    }

    const cacheControl = filePath.includes(`${path.sep}assets${path.sep}`)
      ? "public, max-age=31536000, immutable"
      : "no-store";

    await sendFile(res, filePath, cacheControl);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`Static client server listening on http://${host}:${port}`);
});
