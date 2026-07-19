import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git") return [];
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolutePath) : [absolutePath];
  });
}

const textAssets = walk(root).filter((file) =>
  [".html", ".js", ".json", ".txt", ".webmanifest"].includes(path.extname(file)),
);
const htmlAssets = textAssets.filter((file) => file.endsWith(".html"));
const footerRscClass =
  '"className":"inline-flex items-center gap-1.5 text-sm font-bold text-white/70 transition hover:text-lime"';
let serializedFooterCount = 0;

for (const file of textAssets.filter(
  (asset) => asset.endsWith(".html") || asset.endsWith(".txt"),
)) {
  const normalized = fs
    .readFileSync(file, "utf8")
    .replaceAll('\\"', '"');
  for (const accidentalMailto of [
    '"href":"mailto:info%40tirtil.ai","onClick":"$undefined"',
    '"href":"mailto:info%40tirtil.ai","className":"font-bold text-leaf-deep hover:underline"',
  ]) {
    if (normalized.includes(accidentalMailto)) {
      fail(
        `${path.relative(root, file)} contains a footer mailto outside the footer`,
      );
    }
  }
  let cursor = 0;
  while (true) {
    const markerIndex = normalized.indexOf(footerRscClass, cursor);
    if (markerIndex < 0) break;
    serializedFooterCount += 1;
    const before = normalized.slice(Math.max(0, markerIndex - 100), markerIndex);
    const after = normalized.slice(
      markerIndex,
      markerIndex + 1_500,
    );
    if (!before.includes('"href":"mailto:info%40tirtil.ai"')) {
      fail(`${path.relative(root, file)} RSC footer has the wrong email target`);
    }
    if (
      !after.includes(
        '["$","span",null,{"children":"info@tirtil.ai"}]',
      )
    ) {
      fail(`${path.relative(root, file)} RSC footer splits the email address`);
    }
    cursor = markerIndex + footerRscClass.length;
  }
}

if (serializedFooterCount !== 28) {
  fail(`Expected 28 serialized footers, found ${serializedFooterCount}`);
}

const pagesWithNavbar = htmlAssets.filter((file) => {
  const html = fs.readFileSync(file, "utf8");
  return html.includes("<header") && html.includes("<nav");
});

if (pagesWithNavbar.length !== 7) {
  fail(`Expected 7 rendered pages with a navbar, found ${pagesWithNavbar.length}`);
}

for (const file of pagesWithNavbar) {
  const html = fs.readFileSync(file, "utf8");
  const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
  if (header.includes("Fiyat Teklifi Al")) {
    fail(`Navbar CTA still rendered in ${path.relative(root, file)}`);
  }
  const footer = html.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? "";
  const emailLink =
    footer.match(
      /<a href="mailto:info%40tirtil\.ai"[^>]*>[\s\S]*?<\/a>/,
    )?.[0] ?? "";
  if (!emailLink.includes("info&#64;tirtil.ai")) {
    fail(
      `${path.relative(root, file)} footer is missing the continuous email address`,
    );
  }
  if (/<span>info<\/span>|<span>@<\/span>|<span>tirtil\.ai<\/span>/.test(emailLink)) {
    fail(`${path.relative(root, file)} footer still splits the email address`);
  }
  if (footer.includes("<!--email_off-->") || footer.includes("<!--/email_off-->")) {
    fail(`${path.relative(root, file)} footer contains hydration-unsafe comments`);
  }
}

const homepage = read("index.html");
const navbarChunkName = homepage.match(
  /\/_next\/static\/chunks\/(315ajipttop0d\.[a-f0-9]+\.js)/,
)?.[1];

if (!navbarChunkName) fail("Homepage does not reference a versioned navbar chunk");
const navbarChunk = navbarChunkName
  ? read(`_next/static/chunks/${navbarChunkName}`)
  : "";
const navbarHash = crypto.createHash("sha256").update(navbarChunk).digest("hex").slice(0, 8);
if (navbarChunkName && !navbarChunkName.endsWith(`.${navbarHash}.js`)) {
  fail("Navbar chunk filename does not match its current content");
}
if (navbarChunk.includes('label:"Fiyat Teklifi Al"')) {
  fail("Hydrated navbar still defines the Fiyat Teklifi Al CTA");
}

for (const file of pagesWithNavbar) {
  const html = fs.readFileSync(file, "utf8");
  if (!html.includes(`/_next/static/chunks/${navbarChunkName}`)) {
    fail(`${path.relative(root, file)} references a different navbar chunk`);
  }
}

const contactSection =
  homepage.match(/<section id="iletisim"[\s\S]*?<\/section>/)?.[0] ?? "";

if (!contactSection) fail("Homepage contact section is missing");
if (/<form\b|<input\b|<textarea\b/i.test(contactSection)) {
  fail("Homepage contact section still contains form controls");
}
if (!contactSection.includes("Detaylı bilgi ve iletişim")) {
  fail("Homepage contact section is missing the new information copy");
}
if (!contactSection.includes('href="/#iletisim"')) {
  fail("Homepage contact email is missing its same-origin hydration-safe fallback");
}
for (const emailPart of [
  '<span>info</span>',
  '<span>@</span>',
  '<span>tirtil.ai</span>',
]) {
  if (!contactSection.includes(emailPart)) {
    fail(`Homepage contact email is missing ${emailPart}`);
  }
}

const contactChunkName = homepage.match(
  /\/_next\/static\/chunks\/(2g1d2c7b0pyw_\.[a-f0-9]+\.js)/,
)?.[1];

if (!contactChunkName) fail("Homepage does not reference a versioned contact chunk");
const contactChunk = contactChunkName
  ? read(`_next/static/chunks/${contactChunkName}`)
  : "";
const contactHash = crypto.createHash("sha256").update(contactChunk).digest("hex").slice(0, 8);
if (contactChunkName && !contactChunkName.endsWith(`.${contactHash}.js`)) {
  fail("Contact chunk filename does not match its current content");
}
const contactModule =
  contactChunk.match(/51062,e=>\{[\s\S]*?\}\],51062\)/)?.[0] ?? "";

if (!contactModule) fail("Hydrated contact module is missing");
for (const staleClientToken of [
  "FormData",
  "fetch(",
  "contactFormEndpoint",
  "Fiyat Teklifi İste",
]) {
  if (contactModule.includes(staleClientToken)) {
    fail(`Hydrated contact module still contains ${staleClientToken}`);
  }
}
if (!contactModule.includes("mailto:")) {
  fail("Hydrated contact email does not open a mail client");
}

let navbarReferenceCount = 0;
let contactReferenceCount = 0;
const referencedNavbarChunks = new Set();
const referencedContactChunks = new Set();

for (const file of textAssets) {
  const contents = fs.readFileSync(file, "utf8");
  for (const match of contents.matchAll(/315ajipttop0d\.[a-f0-9]+\.js/g)) {
    referencedNavbarChunks.add(match[0]);
    navbarReferenceCount += 1;
  }
  for (const match of contents.matchAll(/2g1d2c7b0pyw_\.[a-f0-9]+\.js/g)) {
    referencedContactChunks.add(match[0]);
    contactReferenceCount += 1;
  }
  for (const staleToken of [
    "formsubmit.co",
    "FormSubmit",
    "contactFormEndpoint",
    "Fiyat Teklifi İste",
  ]) {
    if (contents.includes(staleToken)) {
      fail(`${path.relative(root, file)} still contains ${staleToken}`);
    }
  }
}

if (
  referencedNavbarChunks.size !== 1 ||
  !referencedNavbarChunks.has(navbarChunkName)
) {
  fail(`Generated artifacts reference inconsistent navbar chunks`);
}
if (navbarReferenceCount !== 198) {
  fail(`Expected 198 navbar chunk references, found ${navbarReferenceCount}`);
}
if (
  referencedContactChunks.size !== 1 ||
  !referencedContactChunks.has(contactChunkName)
) {
  fail(`Generated artifacts reference inconsistent contact chunks`);
}
if (contactReferenceCount !== 39) {
  fail(`Expected 39 contact chunk references, found ${contactReferenceCount}`);
}

const privacyAssets = textAssets.filter((file) =>
  file.includes(`${path.sep}gizlilik${path.sep}`),
);
for (const file of privacyAssets) {
  const contents = fs.readFileSync(file, "utf8");
  if (contents.toLocaleLowerCase("tr").includes("iletişim formu")) {
    fail(`${path.relative(root, file)} still describes the removed contact form`);
  }
}

if (!homepage.includes("Fiyat Teklifi Al")) {
  fail("The separate homepage hero CTA was removed outside the requested scope");
}
if (!homepage.includes("Tırtıl hakkında nasıl bilgi alabilirim?")) {
  fail("Homepage FAQ does not describe the new email-only contact path");
}

const contactAlias = read("iletisim/index.html");
if (!contactAlias.includes("url=/#iletisim")) {
  fail("/iletisim/ no longer redirects to the homepage contact section");
}

if (failures.length) {
  console.error(`Contact contract failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Contact contract passed: ${pagesWithNavbar.length} navbars, email-only contact section, no FormSubmit artifacts.`,
);
