#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const expectedMetadata = {
  icon: "/favicon-tirtil-v7-32.png",
  mask: "/safari-pinned-tab-v7.svg",
  apple: "/apple-touch-icon-tirtil-v7.png",
};
const expectedAssets = {
  ico: "/favicon-tirtil-v7.ico",
  png: expectedMetadata.icon,
  mask: expectedMetadata.mask,
  apple: expectedMetadata.apple,
};
const expectedAssetHashes = {
  ico: "cc5e31041ba3f03793d9f44a7dac640093ec24d95a45d32269c028f4b85c00bd",
  png: "3a2ecfef9842699f053640106cd0135770cadcf9871c68328a7df1916ff17639",
  mask: "5400864307adffc06cca9992ce969d045ab54536ad91d0c3650d5a5e49f4cdaf",
  apple: "76998cd86305a437d031bba6c41dd9b60c050a2854ce85a1a84c5d8ea900eabf",
};
const bannedVercelFaviconHash =
  "2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932";
const expectedPaths = new Set(Object.values(expectedMetadata));
const failures = [];

function fail(message, details = undefined) {
  failures.push({ message, details });
}

function trackedFiles(pattern) {
  const output = execFileSync(
    "git",
    ["-C", repositoryRoot, "ls-files", pattern],
    { encoding: "utf8" },
  ).trim();
  return output ? output.split("\n") : [];
}

const htmlFiles = trackedFiles("*.html");
const payloadFiles = trackedFiles("*.txt");
const metadataFiles = [];
const legacyPatterns = [
  "favicon-tirtil-6392dd24.ico",
  "favicon-mark-v5",
  "favicon-tirtil-v6",
  "_next/static/media/favicon",
];

for (const file of [...htmlFiles, ...payloadFiles]) {
  const absolutePath = path.join(repositoryRoot, file);
  const source = fs.readFileSync(absolutePath, "utf8");
  const normalized = source.replaceAll('\\"', '"');
  const usesIconMetadata =
    /<link\b[^>]*\brel="(?:icon|apple-touch-icon|mask-icon)"/i.test(
      normalized,
    ) ||
    /"rel":"(?:icon|apple-touch-icon|mask-icon)","href":/i.test(
      normalized,
    );
  if (!usesIconMetadata) continue;

  metadataFiles.push(file);
  for (const legacy of legacyPatterns) {
    if (source.includes(legacy)) {
      fail("Legacy favicon reference remains", { file, legacy });
    }
  }

  const hrefs = [
    ...normalized.matchAll(
      /<link\b[^>]*\brel="(?:icon|apple-touch-icon|mask-icon)"[^>]*\bhref="([^"]+)"/gi,
    ),
    ...normalized.matchAll(
      /"rel":"(?:icon|apple-touch-icon|mask-icon)","href":"([^"]+)"/gi,
    ),
  ].map((match) => match[1]);
  const iconHrefs = [
    ...normalized.matchAll(
      /<link\b[^>]*\brel="icon"[^>]*\bhref="([^"]+)"/gi,
    ),
    ...normalized.matchAll(
      /"rel":"icon","href":"([^"]+)"/gi,
    ),
  ].map((match) => match[1]);

  const unexpected = hrefs.filter((href) => !expectedPaths.has(href));
  if (unexpected.length > 0) {
    fail("Unexpected browser-selectable icon reference", {
      file,
      unexpected,
    });
  }

  for (const expectedPath of expectedPaths) {
    if (!hrefs.includes(expectedPath)) {
      fail("Required favicon reference missing", {
        file,
        expectedPath,
      });
    }
  }
  if (
    new Set(iconHrefs).size !== 1 ||
    !iconHrefs.includes(expectedMetadata.icon)
  ) {
    fail("Normal-tab favicon must have exactly one unambiguous source", {
      file,
      iconHrefs,
    });
  }

  if (file.endsWith(".html")) {
    const firstPositions = Object.fromEntries(
      Object.entries(expectedMetadata).map(([kind, href]) => [
        kind,
        normalized.indexOf(`href="${href}"`),
      ]),
    );
    const ordered = [
      firstPositions.icon,
      firstPositions.mask,
      firstPositions.apple,
    ];
    if (
      ordered.some((position) => position < 0) ||
      ordered.some(
        (position, index) => index > 0 && position <= ordered[index - 1],
      )
    ) {
      fail("HTML favicon preference order is invalid", {
        file,
        firstPositions,
      });
    }
  }
}

if (htmlFiles.length !== 13) {
  fail("Unexpected HTML artifact count", {
    expected: 13,
    actual: htmlFiles.length,
  });
}
if (metadataFiles.length !== 37) {
  fail("Unexpected favicon metadata artifact count", {
    expected: 37,
    actual: metadataFiles.length,
  });
}

const assetPaths = Object.fromEntries(
  Object.entries(expectedAssets).map(([kind, href]) => [
    kind,
    path.join(repositoryRoot, href.slice(1)),
  ]),
);

for (const [kind, assetPath] of Object.entries(assetPaths)) {
  if (!fs.existsSync(assetPath)) {
    fail("Required favicon asset missing", { kind, assetPath });
    continue;
  }
  const hash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(assetPath))
    .digest("hex");
  if (hash !== expectedAssetHashes[kind]) {
    fail("Favicon asset bytes do not match the reviewed artwork", {
      kind,
      expected: expectedAssetHashes[kind],
      actual: hash,
    });
  }
}

for (const file of trackedFiles("*.ico")) {
  const hash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(repositoryRoot, file)))
    .digest("hex");
  if (hash === bannedVercelFaviconHash) {
    fail("Original create-next-app/Vercel favicon bytes remain tracked", {
      file,
      hash,
    });
  }
}

if (fs.existsSync(assetPaths.png)) {
  const signature = fs.readFileSync(assetPaths.png).subarray(0, 8);
  if (!signature.equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    fail("PNG favicon signature is invalid");
  }
}

if (fs.existsSync(assetPaths.apple)) {
  const signature = fs.readFileSync(assetPaths.apple).subarray(0, 8);
  if (!signature.equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    fail("Apple icon signature is invalid");
  }
}

if (fs.existsSync(assetPaths.ico)) {
  const ico = fs.readFileSync(assetPaths.ico);
  if (
    ico.length < 6 ||
    ico.readUInt16LE(0) !== 0 ||
    ico.readUInt16LE(2) !== 1 ||
    ico.readUInt16LE(4) !== 3
  ) {
    fail("ICO favicon must contain exactly three icon frames");
  }
  const rootFallback = path.join(repositoryRoot, "favicon.ico");
  if (
    !fs.existsSync(rootFallback) ||
    !fs.readFileSync(rootFallback).equals(ico)
  ) {
    fail("Root /favicon.ico fallback does not match versioned ICO");
  }
}

for (const kind of ["mask"]) {
  const assetPath = assetPaths[kind];
  if (!fs.existsSync(assetPath)) continue;
  const svg = fs.readFileSync(assetPath, "utf8");
  if (
    !svg.includes("<svg") ||
    /<script\b|javascript:|\b(?:href|src)=["']https?:\/\//i.test(svg)
  ) {
    fail("SVG favicon contains invalid or external content", { kind });
  }
}

console.log(
  JSON.stringify(
    {
      htmlFiles: htmlFiles.length,
      metadataFiles: metadataFiles.length,
      expectedMetadata,
      expectedAssets,
      failureCount: failures.length,
      failures: failures.slice(0, 25),
    },
    null,
    2,
  ),
);

if (failures.length > 0) process.exit(1);
