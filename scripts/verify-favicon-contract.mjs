#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const expectedMetadata = {
  icon: "/favicon-tirtil-v9.ico",
  mask: "/safari-pinned-tab-v9.svg",
  apple180: "/apple-touch-icon-tirtil-v9-180.png",
  apple167: "/apple-touch-icon-tirtil-v9-167.png",
  apple152: "/apple-touch-icon-tirtil-v9-152.png",
  manifest: "/site-tirtil-v9.webmanifest",
};
const expectedAssets = {
  ico: expectedMetadata.icon,
  png: "/favicon-tirtil-v9-32.png",
  mask: expectedMetadata.mask,
  apple180: expectedMetadata.apple180,
  apple167: expectedMetadata.apple167,
  apple152: expectedMetadata.apple152,
  pwaAny192: "/pwa-icon-tirtil-v9-192.png",
  pwaAny512: "/pwa-icon-tirtil-v9-512.png",
  pwaMaskable192: "/pwa-maskable-tirtil-v9-192.png",
  pwaMaskable512: "/pwa-maskable-tirtil-v9-512.png",
  manifest: expectedMetadata.manifest,
};
const expectedAssetHashes = {
  ico: "cc5e31041ba3f03793d9f44a7dac640093ec24d95a45d32269c028f4b85c00bd",
  png: "3a2ecfef9842699f053640106cd0135770cadcf9871c68328a7df1916ff17639",
  mask: "5400864307adffc06cca9992ce969d045ab54536ad91d0c3650d5a5e49f4cdaf",
  apple180:
    "1a2a1b22611366fe99dd780fee0f0e37d567a2759e605bbbafc319bd67ff09ff",
  apple167:
    "73ffc082c2a07b3d7db7041ee71e6fbe1ff29d830be7cde7eabd22e91d98e3d1",
  apple152:
    "e08e59981ace6d168ef08c6a94796232c1c3131084146a5065f438c2a5222536",
  pwaAny192:
    "90c006a380d5a246ee3881ebf90396a4f755272939d39a81fba4a35e69de07f4",
  pwaAny512:
    "d14c33860984f9c4e79084e60349235ee36b6ad4b0c0674bf6f352dc6161de3c",
  pwaMaskable192:
    "087c4476074830c83255bc5877ed0b296af8c41d9df54cb38902c356c34cf89a",
  pwaMaskable512:
    "2b4a26c1b9ae904865c94fca1e3e52c6e85262e4192202d50e8acd5a65ae9f8c",
  manifest:
    "26bd568c8c179ecbb81388a013c9c282571514b45aea85064b712cba32f41e09",
};
const bannedVercelFaviconHash =
  "2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932";
const expectedIconPaths = new Set([
  expectedMetadata.icon,
  expectedMetadata.mask,
  expectedMetadata.apple180,
  expectedMetadata.apple167,
  expectedMetadata.apple152,
]);
const expectedMetadataOccurrences = 47;
const metadataOccurrenceCounts = {
  icon: 0,
  mask: 0,
  apple180: 0,
  apple167: 0,
  apple152: 0,
  manifest: 0,
  themeColor: 0,
  applicationName: 0,
  appleTitle: 0,
};
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
  "favicon-tirtil-v7",
  "favicon-tirtil-v8",
  "apple-touch-icon-tirtil-v7",
  "safari-pinned-tab-v7",
  "_next/static/media/favicon",
];

const metadataRecords = {
  icon: [
    `<link rel="icon" href="${expectedMetadata.icon}" sizes="16x16 32x32 48x48" type="image/vnd.microsoft.icon">`,
    `"rel":"icon","href":"${expectedMetadata.icon}","sizes":"16x16 32x32 48x48","type":"image/vnd.microsoft.icon"`,
  ],
  mask: [
    `<link rel="mask-icon" href="${expectedMetadata.mask}" color="#A8D84F">`,
    `"rel":"mask-icon","href":"${expectedMetadata.mask}","color":"#A8D84F"`,
  ],
  apple180: [
    `<link rel="apple-touch-icon" href="${expectedMetadata.apple180}" sizes="180x180" type="image/png">`,
    `"rel":"apple-touch-icon","href":"${expectedMetadata.apple180}","sizes":"180x180","type":"image/png"`,
  ],
  apple167: [
    `<link rel="apple-touch-icon" href="${expectedMetadata.apple167}" sizes="167x167" type="image/png">`,
    `"rel":"apple-touch-icon","href":"${expectedMetadata.apple167}","sizes":"167x167","type":"image/png"`,
  ],
  apple152: [
    `<link rel="apple-touch-icon" href="${expectedMetadata.apple152}" sizes="152x152" type="image/png">`,
    `"rel":"apple-touch-icon","href":"${expectedMetadata.apple152}","sizes":"152x152","type":"image/png"`,
  ],
  manifest: [
    `<link rel="manifest" href="${expectedMetadata.manifest}">`,
    `"rel":"manifest","href":"${expectedMetadata.manifest}"`,
  ],
  themeColor: [
    '<meta name="theme-color" content="#0A2214">',
    '"name":"theme-color","content":"#0A2214"',
  ],
  applicationName: [
    '<meta name="application-name" content="Tırtıl">',
    '"name":"application-name","content":"Tırtıl"',
  ],
  appleTitle: [
    '<meta name="apple-mobile-web-app-title" content="Tırtıl">',
    '"name":"apple-mobile-web-app-title","content":"Tırtıl"',
  ],
};

function countLiteral(source, needle) {
  return source.split(needle).length - 1;
}

function countMetadataRecord(source, kind) {
  return metadataRecords[kind].reduce(
    (total, record) => total + countLiteral(source, record),
    0,
  );
}

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

  const fileRecordCounts = Object.fromEntries(
    Object.keys(metadataRecords).map((kind) => [
      kind,
      countMetadataRecord(normalized, kind),
    ]),
  );
  for (const [kind, count] of Object.entries(fileRecordCounts)) {
    metadataOccurrenceCounts[kind] += count;
    if (count < 1) {
      fail("Required favicon/device metadata record missing or invalid", {
        file,
        kind,
      });
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
  const manifestHrefs = [
    ...normalized.matchAll(
      /<link\b[^>]*\brel="manifest"[^>]*\bhref="([^"]+)"/gi,
    ),
    ...normalized.matchAll(
      /"rel":"manifest","href":"([^"]+)"/gi,
    ),
  ].map((match) => match[1]);

  const unexpected = hrefs.filter((href) => !expectedIconPaths.has(href));
  if (unexpected.length > 0) {
    fail("Unexpected browser-selectable icon reference", {
      file,
      unexpected,
    });
  }

  for (const expectedPath of expectedIconPaths) {
    if (!hrefs.includes(expectedPath)) {
      fail("Required favicon reference missing", {
        file,
        expectedPath,
      });
    }
  }
  for (const [kind, expectedPath] of Object.entries(expectedMetadata)) {
    if (kind === "manifest") continue;
    const hrefCount = hrefs.filter((href) => href === expectedPath).length;
    if (hrefCount !== fileRecordCounts[kind]) {
      fail("Favicon metadata has invalid sizes, type, or color", {
        file,
        kind,
        hrefCount,
        validRecordCount: fileRecordCounts[kind],
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
  if (
    manifestHrefs.length !== fileRecordCounts.manifest ||
    manifestHrefs.some((href) => href !== expectedMetadata.manifest)
  ) {
    fail("Web app manifest metadata is missing or ambiguous", {
      file,
      manifestHrefs,
      validRecordCount: fileRecordCounts.manifest,
    });
  }
  const expectedMetaValues = {
    themeColor: ["theme-color", "#0A2214"],
    applicationName: ["application-name", "Tırtıl"],
    appleTitle: ["apple-mobile-web-app-title", "Tırtıl"],
  };
  for (const [kind, [name, expectedContent]] of Object.entries(
    expectedMetaValues,
  )) {
    const contents = [
      ...normalized.matchAll(
        new RegExp(
          `<meta\\b[^>]*\\bname="${name}"[^>]*\\bcontent="([^"]*)"`,
          "gi",
        ),
      ),
      ...normalized.matchAll(
        new RegExp(`"name":"${name}","content":"([^"]*)"`, "gi"),
      ),
    ].map((match) => match[1]);
    if (
      contents.length !== fileRecordCounts[kind] ||
      contents.some((content) => content !== expectedContent)
    ) {
      fail("Device metadata value is missing or ambiguous", {
        file,
        name,
        contents,
        validRecordCount: fileRecordCounts[kind],
      });
    }
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
      firstPositions.apple180,
      firstPositions.apple167,
      firstPositions.apple152,
      firstPositions.manifest,
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
for (const [kind, count] of Object.entries(metadataOccurrenceCounts)) {
  if (count !== expectedMetadataOccurrences) {
    fail("Unexpected favicon/device metadata occurrence count", {
      kind,
      expected: expectedMetadataOccurrences,
      actual: count,
    });
  }
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

function validatePngIhdr(
  kind,
  expectedWidth,
  expectedHeight,
  allowedColorTypes,
) {
  const assetPath = assetPaths[kind];
  if (!assetPath || !fs.existsSync(assetPath)) return;
  const png = fs.readFileSync(assetPath);
  const signature = Buffer.from("89504e470d0a1a0a", "hex");
  if (
    png.length < 33 ||
    !png.subarray(0, 8).equals(signature) ||
    png.readUInt32BE(8) !== 13 ||
    png.toString("ascii", 12, 16) !== "IHDR"
  ) {
    fail("PNG has an invalid signature or IHDR chunk", { kind });
    return;
  }
  const actual = {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    bitDepth: png.readUInt8(24),
    colorType: png.readUInt8(25),
  };
  if (
    actual.width !== expectedWidth ||
    actual.height !== expectedHeight ||
    actual.bitDepth !== 8 ||
    !allowedColorTypes.includes(actual.colorType)
  ) {
    fail("PNG dimensions, bit depth, or color type are invalid", {
      kind,
      expected: {
        width: expectedWidth,
        height: expectedHeight,
        bitDepth: 8,
        allowedColorTypes,
      },
      actual,
    });
  }
}

validatePngIhdr("png", 32, 32, [2, 6]);
validatePngIhdr("apple180", 180, 180, [2]);
validatePngIhdr("apple167", 167, 167, [2]);
validatePngIhdr("apple152", 152, 152, [2]);
validatePngIhdr("pwaAny192", 192, 192, [2]);
validatePngIhdr("pwaAny512", 512, 512, [2]);
validatePngIhdr("pwaMaskable192", 192, 192, [2]);
validatePngIhdr("pwaMaskable512", 512, 512, [2]);

if (fs.existsSync(assetPaths.ico)) {
  const ico = fs.readFileSync(assetPaths.ico);
  if (
    ico.length < 6 ||
    ico.readUInt16LE(0) !== 0 ||
    ico.readUInt16LE(2) !== 1 ||
    ico.readUInt16LE(4) !== 3 ||
    ico.length < 6 + 3 * 16
  ) {
    fail("ICO favicon must contain exactly three icon frames");
  } else {
    const frames = Array.from({ length: 3 }, (_, index) => {
      const offset = 6 + index * 16;
      const width = ico.readUInt8(offset) || 256;
      const height = ico.readUInt8(offset + 1) || 256;
      const byteLength = ico.readUInt32LE(offset + 8);
      const byteOffset = ico.readUInt32LE(offset + 12);
      return { width, height, byteLength, byteOffset };
    });
    const dimensions = frames
      .map(({ width, height }) => `${width}x${height}`)
      .sort();
    if (
      dimensions.join(",") !== ["16x16", "32x32", "48x48"].sort().join(",") ||
      frames.some(
        ({ byteLength, byteOffset }) =>
          byteLength < 1 ||
          byteOffset < 6 + 3 * 16 ||
          byteOffset + byteLength > ico.length,
      )
    ) {
      fail("ICO frames must be valid 16x16, 32x32, and 48x48 entries", {
        frames,
      });
    }
  }
  const rootFallback = path.join(repositoryRoot, "favicon.ico");
  if (
    !fs.existsSync(rootFallback) ||
    !fs.readFileSync(rootFallback).equals(ico)
  ) {
    fail("Root /favicon.ico fallback does not match versioned ICO");
  }
}

if (fs.existsSync(assetPaths.apple180)) {
  const rootAppleFallback = path.join(repositoryRoot, "apple-touch-icon.png");
  if (
    !fs.existsSync(rootAppleFallback) ||
    !fs
      .readFileSync(rootAppleFallback)
      .equals(fs.readFileSync(assetPaths.apple180))
  ) {
    fail(
      "Root /apple-touch-icon.png fallback does not match the 180x180 icon",
    );
  }
}

if (
  fs.existsSync(assetPaths.pwaAny192) &&
  fs.existsSync(assetPaths.pwaMaskable192) &&
  fs
    .readFileSync(assetPaths.pwaAny192)
    .equals(fs.readFileSync(assetPaths.pwaMaskable192))
) {
  fail("192x192 any and maskable icons must use separate artwork");
}
if (
  fs.existsSync(assetPaths.pwaAny512) &&
  fs.existsSync(assetPaths.pwaMaskable512) &&
  fs
    .readFileSync(assetPaths.pwaAny512)
    .equals(fs.readFileSync(assetPaths.pwaMaskable512))
) {
  fail("512x512 any and maskable icons must use separate artwork");
}

if (fs.existsSync(assetPaths.manifest)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(assetPaths.manifest, "utf8"));
    const expectedManifestIcons = [
      {
        src: expectedAssets.pwaAny192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: expectedAssets.pwaAny512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: expectedAssets.pwaMaskable192,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: expectedAssets.pwaMaskable512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ];
    if (
      manifest.id !== "/" ||
      manifest.name !== "Tırtıl" ||
      manifest.short_name !== "Tırtıl" ||
      manifest.start_url !== "/" ||
      manifest.scope !== "/" ||
      manifest.display !== "browser" ||
      manifest.background_color !== "#0A2214" ||
      manifest.theme_color !== "#0A2214"
    ) {
      fail("Web app manifest identity or display metadata is invalid", {
        manifest,
      });
    }
    const actualIcons = Array.isArray(manifest.icons) ? manifest.icons : [];
    if (
      actualIcons.length !== expectedManifestIcons.length ||
      expectedManifestIcons.some(
        (expectedIcon) =>
          !actualIcons.some(
            (actualIcon) =>
              actualIcon.src === expectedIcon.src &&
              actualIcon.sizes === expectedIcon.sizes &&
              actualIcon.type === expectedIcon.type &&
              actualIcon.purpose === expectedIcon.purpose,
          ),
      )
    ) {
      fail("Web app manifest icon suite is invalid", {
        expected: expectedManifestIcons,
        actual: actualIcons,
      });
    }
    const anySources = new Set(
      actualIcons
        .filter(({ purpose }) => purpose === "any")
        .map(({ src }) => src),
    );
    const maskableSources = new Set(
      actualIcons
        .filter(({ purpose }) => purpose === "maskable")
        .map(({ src }) => src),
    );
    if (
      anySources.size !== 2 ||
      maskableSources.size !== 2 ||
      [...anySources].some((src) => maskableSources.has(src))
    ) {
      fail("Manifest any and maskable icon sources must be separate", {
        anySources: [...anySources],
        maskableSources: [...maskableSources],
      });
    }
  } catch (error) {
    fail("Web app manifest is not valid JSON", { error: error.message });
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
      metadataOccurrenceCounts,
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
