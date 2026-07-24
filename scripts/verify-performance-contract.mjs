import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const homepage = readFileSync(path.join(root, "index.html"), "utf8");

function fail(message) {
  throw new Error(`Performance contract failed: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function verifyHashedAsset(publicPath) {
  const match = publicPath.match(/\.([0-9a-f]{8}|[0-9a-f]{12})\.[^.]+$/u);
  assert(match, `${publicPath} content hash içermiyor`);

  const diskPath = path.join(root, publicPath.replace(/^\//u, ""));
  assert(existsSync(diskPath), `${publicPath} bulunamadı`);

  const actualHash = createHash("sha256")
    .update(readFileSync(diskPath))
    .digest("hex")
    .slice(0, match[1].length);
  assert(
    actualHash === match[1],
    `${publicPath} hash uyuşmazlığı (${actualHash})`,
  );
}

assert(
  !homepage.includes(
    '<link rel="preload" as="image" href="/brand/tirtil-kilit.webp"/>',
  ),
  "navbar logosu gereksiz preload edilmemeli",
);

const screenshotNames = ["panel", "tekrar", "takvim", "analiz", "tahminler"];
for (const name of screenshotNames) {
  assert(
    !homepage.includes(`/site/${name}.webp`),
    `${name} eski tek-boyut görselini kullanıyor`,
  );

  const imageMatch = homepage.match(
    new RegExp(
      `<img[^>]+src="/site/${name}-600\\.[0-9a-f]{12}\\.webp"[^>]+srcSet="([^"]+)"[^>]*>`,
      "u",
    ),
  );
  assert(imageMatch, `${name} responsive img etiketi bulunamadı`);

  const srcset = imageMatch[1];
  for (const width of [480, 600, 720, 960, 1440]) {
    assert(
      srcset.includes(`/site/${name}-${width}.`) &&
        srcset.includes(` ${width}w`),
      `${name} ${width}w adayı eksik`,
    );
  }

  for (const publicPath of srcset.match(/\/site\/[^ ,"]+\.webp/gu) ?? []) {
    verifyHashedAsset(publicPath);
  }

  const defaultSource = imageMatch[0].match(/src="([^"]+)"/u)?.[1];
  assert(defaultSource, `${name} varsayılan src eksik`);
  verifyHashedAsset(defaultSource);
}

for (const publicPath of [
  "/brand/tirtil-kilit-240.def12cf68400.webp",
  "/brand/tirtil-kilit-koyu-240.f83b66f1c9ca.webp",
]) {
  assert(homepage.includes(publicPath), `${publicPath} HTML'de kullanılmıyor`);
  verifyHashedAsset(publicPath);
}

const cssPath = homepage.match(
  /href="(\/_next\/static\/chunks\/2nbiben_kk6qb\.[0-9a-f]{12}\.css)"/u,
)?.[1];
assert(cssPath, "hashli production CSS bulunamadı");
verifyHashedAsset(cssPath);
assert(
  statSync(path.join(root, cssPath.slice(1))).size < 50_000,
  "production CSS 50 KB bütçesini aşıyor",
);

for (const chunkPattern of [
  /\/_next\/static\/chunks\/(2g1d2c7b0pyw_\.[0-9a-f]{8}\.js)/u,
  /\/_next\/static\/chunks\/(315ajipttop0d\.[0-9a-f]{8}\.js)/u,
]) {
  const chunk = homepage.match(chunkPattern)?.[1];
  assert(chunk, `hashli client chunk bulunamadı: ${chunkPattern}`);
  verifyHashedAsset(`/_next/static/chunks/${chunk}`);
}

console.log("Performance contract: PASS");
