#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const canonicalIconHref = "/favicon-a6b920f9.png";
const canonicalIconFile = canonicalIconHref.slice(1);
const canonicalIconHash =
  "a6b920f9931dc0558436d967f2d0446a2609fce4125923e0e646974323cace5b";
const contactEmail = "info@tirtil.ai";
const contactMailtoHref = "mailto:info%40tirtil.ai";
const continuousEmailTextPattern =
  /(?:^|>)\s*info(?:@|&#0*64;|&#x0*40;)tirtil\.ai\s*(?=<|$)/gi;
const expectedHtmlFiles = 13;
const expectedRenderedFooters = 7;
const maxFailureExamples = 2;

// This is the create-next-app/Vercel triangle that previously shipped here.
// Scan every tracked file, rather than only *.ico, so renaming it cannot bypass
// the contract.
const bannedVercelHashes = new Set([
  "2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932",
]);

const failures = new Map();

function fail(code, message, detail) {
  const failure = failures.get(code) ?? {
    code,
    message,
    count: 0,
    examples: [],
  };
  failure.count += 1;
  if (detail !== undefined && failure.examples.length < maxFailureExamples) {
    failure.examples.push(detail);
  }
  failures.set(code, failure);
}

function trackedFiles(...patterns) {
  const args = ["-C", repositoryRoot, "ls-files", "-z"];
  if (patterns.length > 0) args.push("--", ...patterns);
  return execFileSync("git", args, { encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .sort();
}

function read(file) {
  return fs.readFileSync(path.join(repositoryRoot, file), "utf8");
}

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(repositoryRoot, file)))
    .digest("hex");
}

function parseAttributes(tag) {
  const attributes = new Map();
  const attributePattern =
    /\s([^\s"'=<>`/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of tag.matchAll(attributePattern)) {
    attributes.set(
      match[1].toLowerCase(),
      match[2] ?? match[3] ?? match[4] ?? "",
    );
  }
  return attributes;
}

function relationTokens(attributes) {
  return (attributes.get("rel") ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function extractHtmlLinks(source) {
  return [...source.matchAll(/<link\b[^>]*>/gi)].map((match) => ({
    tag: match[0],
    attributes: parseAttributes(match[0]),
  }));
}

function relationLinks(links, relation) {
  return links.filter(({ attributes }) =>
    relationTokens(attributes).includes(relation),
  );
}

function isBrowserIconAsset(file) {
  const normalized = file.replaceAll("\\", "/").toLowerCase();
  const basename = path.posix.basename(normalized);
  const extension = path.posix.extname(basename);
  if (
    !new Set([".png", ".ico", ".svg", ".webp", ".jpg", ".jpeg", ".avif"]).has(
      extension,
    )
  ) {
    return false;
  }
  if (normalized === canonicalIconFile) return true;
  return (
    /(?:^|[-_.])favicon(?:[-_.]|$)/.test(basename) ||
    /^(?:apple-(?:touch-)?icon|apple-icon)(?:[-_.]|$)/.test(basename) ||
    /^(?:icon|touch-icon|mask-icon)(?:[-_.]|$)/.test(basename) ||
    /^pwa-(?:icon|maskable)(?:[-_.]|$)/.test(basename) ||
    /^safari-pinned-tab(?:[-_.]|$)/.test(basename) ||
    /^app-(?:icon|ikonu)(?:[-_.]|$)/.test(basename)
  );
}

function extractRscRelations(source) {
  const normalized = source.replaceAll('\\"', '"').replaceAll("\\/", "/");
  const relations = [];
  const objectPattern = /\{[^{}]{0,1200}\}/g;

  for (const objectMatch of normalized.matchAll(objectPattern)) {
    const object = objectMatch[0];
    const relation = object.match(
      /"rel"\s*:\s*"(icon|apple-touch-icon|mask-icon)"/i,
    )?.[1];
    if (!relation) continue;
    const href = object.match(/"href"\s*:\s*"([^"]+)"/i)?.[1];
    if (href) {
      relations.push({
        relation: relation.toLowerCase(),
        href,
      });
    }
  }

  return {
    normalized,
    relations,
    hasMetadata:
      /"rel"\s*:\s*"(?:icon|apple-touch-icon|mask-icon)"/i.test(normalized),
  };
}

function uniqueHrefs(relations, relation) {
  return [
    ...new Set(
      relations
        .filter((record) => record.relation === relation)
        .map((record) => record.href),
    ),
  ].sort();
}

function validateCanonicalRelation(file, kind, hrefs) {
  if (hrefs.length !== 1 || hrefs[0] !== canonicalIconHref) {
    fail(
      `RSC_${kind.toUpperCase().replaceAll("-", "_")}`,
      `RSC ${kind} metadata must resolve only to the canonical icon`,
      { file, hrefs },
    );
  }
}

function textReferences(source) {
  const references = new Set();
  const referencePattern =
    /\/[^\s"'\\<>]+?\.(?:png|ico|svg|webp|jpg|jpeg|avif|webmanifest)(?:[?#][^\s"'\\<>]*)?/gi;
  for (const match of source.matchAll(referencePattern)) {
    references.add(match[0]);
  }
  return [...references].sort();
}

const allTrackedFiles = trackedFiles();
const htmlFiles = allTrackedFiles.filter((file) => file.endsWith(".html"));
const txtFiles = allTrackedFiles.filter((file) => file.endsWith(".txt"));
const manifestFiles = allTrackedFiles.filter((file) =>
  file.endsWith(".webmanifest"),
);
const contractTextFiles = [...htmlFiles, ...txtFiles, ...manifestFiles];
const iconAssets = allTrackedFiles.filter(isBrowserIconAsset);

if (
  iconAssets.length !== 1 ||
  iconAssets[0] !== canonicalIconFile
) {
  fail(
    "ICON_ASSET_SET",
    "Exactly one tracked browser/app icon asset must remain",
    {
      expected: [canonicalIconFile],
      actualCount: iconAssets.length,
      actual: iconAssets.slice(0, 12),
    },
  );
}

if (!allTrackedFiles.includes(canonicalIconFile)) {
  fail("CANONICAL_ICON_MISSING", "Canonical icon is not tracked", {
    file: canonicalIconFile,
  });
} else {
  const actualHash = sha256(canonicalIconFile);
  if (actualHash !== canonicalIconHash) {
    fail(
      "CANONICAL_ICON_HASH",
      "Canonical icon bytes differ from the approved Tırtıl artwork",
      {
        file: canonicalIconFile,
        expected: canonicalIconHash,
        actual: actualHash,
      },
    );
  }
}

for (const file of allTrackedFiles) {
  if (bannedVercelHashes.has(sha256(file))) {
    fail(
      "VERCEL_ASSET_HASH",
      "Historical create-next-app/Vercel triangle bytes remain tracked",
      { file, hash: sha256(file) },
    );
  }
}

if (htmlFiles.length !== expectedHtmlFiles) {
  fail("HTML_COUNT", "Tracked HTML artifact count changed", {
    expected: expectedHtmlFiles,
    actual: htmlFiles.length,
  });
}

let renderedFooterCount = 0;
for (const file of htmlFiles) {
  const source = read(file);
  const links = extractHtmlLinks(source);
  const iconLinks = relationLinks(links, "icon");
  const appleLinks = relationLinks(links, "apple-touch-icon");
  const maskLinks = relationLinks(links, "mask-icon");
  const manifestLinks = relationLinks(links, "manifest");

  if (
    iconLinks.length !== 1 ||
    iconLinks[0]?.attributes.get("href") !== canonicalIconHref
  ) {
    fail("HTML_ICON", "HTML must contain exactly one canonical rel=icon", {
      file,
      count: iconLinks.length,
      hrefs: iconLinks.map(({ attributes }) => attributes.get("href") ?? null),
    });
  }
  if (
    appleLinks.length !== 1 ||
    appleLinks[0]?.attributes.get("href") !== canonicalIconHref
  ) {
    fail(
      "HTML_APPLE_TOUCH_ICON",
      "HTML must contain exactly one canonical rel=apple-touch-icon",
      {
        file,
        count: appleLinks.length,
        hrefs: appleLinks.map(
          ({ attributes }) => attributes.get("href") ?? null,
        ),
      },
    );
  }
  if (maskLinks.length > 0) {
    fail("HTML_MASK_ICON", "HTML must not contain rel=mask-icon", {
      file,
      count: maskLinks.length,
    });
  }
  if (manifestLinks.length > 0) {
    fail(
      "HTML_MANIFEST",
      "HTML must not contain a web manifest link",
      {
        file,
        count: manifestLinks.length,
        hrefs: manifestLinks.map(
          ({ attributes }) => attributes.get("href") ?? null,
        ),
      },
    );
  }

  const refreshTokens = [
    "data-tirtil-favicon-refresh",
    "__tirtil_fv",
    "tirtil:favicon:",
    "location.replace",
  ].filter((token) => source.includes(token));
  if (refreshTokens.length > 0) {
    fail(
      "FAVICON_REFRESH_SHIM",
      "Favicon cache/version refresh shim must not be shipped",
      { file, tokens: refreshTokens },
    );
  }

  const footers = source.match(/<footer\b[\s\S]*?<\/footer>/gi) ?? [];
  renderedFooterCount += footers.length;
  if (footers.length > 1) {
    fail("FOOTER_DUPLICATE", "Rendered HTML must not contain duplicate footers", {
      file,
      count: footers.length,
    });
  }

  for (const footer of footers) {
    const anchors = [...footer.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].map(
      (match) => ({
        source: match[0],
        attributes: parseAttributes(match[0].match(/^<a\b[^>]*>/i)?.[0] ?? ""),
      }),
    );
    const mailtoAnchors = anchors.filter(
      ({ attributes }) => attributes.get("href") === contactMailtoHref,
    );
    const continuousEmailNodes =
      footer.match(continuousEmailTextPattern) ?? [];

    if (mailtoAnchors.length !== 1) {
      fail(
        "FOOTER_MAILTO",
        "Footer must contain exactly one native info@tirtil.ai mailto link",
        {
          file,
          count: mailtoAnchors.length,
        },
      );
    }
    if (
      continuousEmailNodes.length !== 1 ||
      mailtoAnchors.length !== 1 ||
      !(mailtoAnchors[0].source.match(continuousEmailTextPattern) ?? []).length
    ) {
      fail(
        "FOOTER_EMAIL_TEXT_NODE",
        "Footer email must be one continuous visible text node inside the mailto link",
        { file, count: continuousEmailNodes.length },
      );
    }
  }
}

if (renderedFooterCount !== expectedRenderedFooters) {
  fail("FOOTER_COUNT", "Rendered footer count changed", {
    expected: expectedRenderedFooters,
    actual: renderedFooterCount,
  });
}

let rscMetadataFiles = 0;
for (const file of txtFiles) {
  const { normalized, relations, hasMetadata } = extractRscRelations(read(file));
  if (!hasMetadata) continue;
  rscMetadataFiles += 1;

  if (relations.length === 0) {
    fail("RSC_METADATA_PARSE", "RSC icon metadata could not be parsed", { file });
    continue;
  }

  validateCanonicalRelation(file, "icon", uniqueHrefs(relations, "icon"));
  validateCanonicalRelation(
    file,
    "apple-touch-icon",
    uniqueHrefs(relations, "apple-touch-icon"),
  );
  const maskHrefs = uniqueHrefs(relations, "mask-icon");
  if (maskHrefs.length > 0) {
    fail("RSC_MASK_ICON", "RSC metadata must not contain mask-icon", {
      file,
      hrefs: maskHrefs,
    });
  }

  if (
    normalized.includes("data-tirtil-favicon-refresh") ||
    normalized.includes("__tirtil_fv") ||
    normalized.includes("tirtil:favicon:")
  ) {
    fail(
      "RSC_REFRESH_SHIM",
      "RSC payload must not serialize a favicon cache/version shim",
      { file },
    );
  }
}

if (manifestFiles.length > 0) {
  fail("MANIFEST_FORBIDDEN", "No web manifest may remain tracked", {
    actual: manifestFiles,
  });
}

for (const file of contractTextFiles) {
  const source = read(file);
  const staleReferences = textReferences(source).filter((reference) => {
    const pathname = reference.split(/[?#]/, 1)[0];
    if (pathname.endsWith(".webmanifest")) {
      return true;
    }
    return (
      isBrowserIconAsset(pathname.slice(1)) &&
      reference !== canonicalIconHref
    );
  });
  if (staleReferences.length > 0) {
    fail(
      "STALE_ICON_REFERENCE",
      "HTML/TXT/manifest contains old or versioned icon references",
      { file, references: staleReferences.slice(0, 10) },
    );
  }
}

const report = {
  status: failures.size === 0 ? "PASS" : "FAIL",
  contract: {
    icon: canonicalIconHref,
    sha256: canonicalIconHash,
    manifest: null,
    footerEmail: contactEmail,
  },
  counts: {
    trackedHtml: htmlFiles.length,
    rscMetadataFiles,
    renderedFooters: renderedFooterCount,
    iconAssets: iconAssets.length,
    manifests: manifestFiles.length,
    failureGroups: failures.size,
  },
  failures: [...failures.values()],
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.size === 0 ? 0 : 1;
