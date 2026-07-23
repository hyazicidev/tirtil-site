#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const expectedLastmod = "2026-07-23";
const failures = [];

const pages = [
  {
    file: "index.html",
    url: "https://tirtil.ai/",
    title: "Yapay Zekâ Destekli YKS Çalışma Koçu | Tırtıl",
    schema: "WebSite",
  },
  {
    file: "blog/index.html",
    url: "https://tirtil.ai/blog/",
    title: "YKS Çalışma Rehberi ve Yapay Zekâ | Tırtıl Blog",
  },
  {
    file: "blog/sinava-90-gun-kala-ornek-bir-hafta/index.html",
    url: "https://tirtil.ai/blog/sinava-90-gun-kala-ornek-bir-hafta/",
    title:
      "Sınava 90 Gün Kala: Tırtıl ile Örnek Bir Çalışma Haftası — Tırtıl",
    schema: "BlogPosting",
  },
  {
    file: "blog/unutma-egrisi-ve-3-7-14-30/index.html",
    url: "https://tirtil.ai/blog/unutma-egrisi-ve-3-7-14-30/",
    title:
      "Unutma Eğrisi ve 3-7-14-30: Tekrarı Şansa Bırakmayan Sistem — Tırtıl",
    schema: "BlogPosting",
  },
  {
    file: "blog/yks-soru-tahmini-nasil-calisir/index.html",
    url: "https://tirtil.ai/blog/yks-soru-tahmini-nasil-calisir/",
    title: "YKS Soru Tahmini Nasıl Çalışır? | Tırtıl",
    schema: "BlogPosting",
  },
  {
    file: "gizlilik/index.html",
    url: "https://tirtil.ai/gizlilik/",
    title: "Gizlilik Politikası — Tırtıl",
  },
  {
    file: "kosullar/index.html",
    url: "https://tirtil.ai/kosullar/",
    title: "Kullanım Şartları — Tırtıl",
  },
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function matchAll(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function fail(message) {
  failures.push(message);
}

function schemaTypes(value) {
  if (Array.isArray(value)) return value.flatMap(schemaTypes);
  if (!value || typeof value !== "object") return [];
  const ownTypes = Array.isArray(value["@type"])
    ? value["@type"]
    : value["@type"]
      ? [value["@type"]]
      : [];
  return [
    ...ownTypes,
    ...schemaTypes(value["@graph"]),
  ];
}

const robots = read("robots.txt");
if (!/^User-Agent:\s*\*\s*$/im.test(robots)) {
  fail("robots.txt does not target all crawlers");
}
if (!/^Allow:\s*\/\s*$/im.test(robots)) {
  fail("robots.txt does not allow the whole site");
}
if (/^Disallow:\s*\/\s*$/im.test(robots)) {
  fail("robots.txt blocks the whole site");
}
if (!/^Sitemap:\s*https:\/\/tirtil\.ai\/sitemap\.xml\s*$/im.test(robots)) {
  fail("robots.txt does not advertise the canonical sitemap");
}

const sitemap = read("sitemap.xml");
const sitemapUrls = matchAll(sitemap, /<loc>([^<]+)<\/loc>/g);
const sitemapLastmods = matchAll(sitemap, /<lastmod>([^<]+)<\/lastmod>/g);
const expectedUrls = pages.map((page) => page.url);

if (
  JSON.stringify([...sitemapUrls].sort()) !==
  JSON.stringify([...expectedUrls].sort())
) {
  fail(`sitemap URLs differ from the indexable page contract`);
}
if (
  sitemapLastmods.length !== pages.length ||
  sitemapLastmods.some((value) => value !== expectedLastmod)
) {
  fail(`sitemap must contain ${pages.length} truthful ${expectedLastmod} lastmod values`);
}

const titles = new Set();
const descriptions = new Set();

for (const page of pages) {
  const html = read(page.file);
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  const description = html.match(
    /<meta name="description" content="([^"]+)"/i,
  )?.[1];
  const canonicals = matchAll(
    html,
    /<link rel="canonical" href="([^"]+)"\/?>/gi,
  );
  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  const robotsMeta = html.match(
    /<meta name="robots" content="([^"]+)"/i,
  )?.[1];

  if (!/<html lang="tr">/i.test(html)) fail(`${page.file} is missing lang=tr`);
  if (title !== page.title) fail(`${page.file} has an unexpected title`);
  if (!description) fail(`${page.file} is missing its meta description`);
  if (canonicals.length !== 1 || canonicals[0] !== page.url) {
    fail(`${page.file} must have one self-referencing canonical`);
  }
  if (h1Count !== 1) fail(`${page.file} must render exactly one H1`);
  if (robotsMeta?.toLowerCase().includes("noindex")) {
    fail(`${page.file} is unexpectedly noindex`);
  }
  if (titles.has(title)) fail(`${page.file} duplicates another page title`);
  if (descriptions.has(description)) {
    fail(`${page.file} duplicates another page description`);
  }
  titles.add(title);
  descriptions.add(description);

  if (page.schema) {
    const schemaScripts = matchAll(
      html,
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
    );
    let parsed;
    try {
      parsed = schemaScripts.map((source) => JSON.parse(source));
    } catch {
      fail(`${page.file} contains invalid JSON-LD`);
      continue;
    }
    const types = parsed.flatMap(schemaTypes);
    if (!types.includes(page.schema)) {
      fail(`${page.file} is missing ${page.schema} structured data`);
    }
  }
}

for (const file of ["404.html", "404/index.html", "_not-found/index.html"]) {
  if (!/<meta name="robots" content="noindex"/i.test(read(file))) {
    fail(`${file} must remain noindex`);
  }
}

if (failures.length > 0) {
  console.error(`SEO contract failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `SEO contract passed: ${pages.length} indexable pages, canonical sitemap, current lastmod values and valid structured data.`,
);
