import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSubmissionUrls, parseSitemapUrls } from "./indexnow-submit.mjs";

const sitemap = readFileSync("sitemap.xml", "utf8");
const keyFile = "edunizam-indexnow-20261107-7f4a9c2d.txt";
const key = readFileSync(keyFile, "utf8").trim();
assert.equal(key, keyFile.slice(0, -4), "public key file content must match its filename");
assert.match(key, /^[a-zA-Z0-9-]{8,128}$/);

const urls = parseSitemapUrls(sitemap);
assert.equal(urls.length, 18, "expected all 18 current public sitemap URLs");
assert.ok(urls.every((url) => new URL(url).hostname === "edunizam.online"));

const changedPublic = buildSubmissionUrls({
  sitemapXml: sitemap,
  changedFiles: ["index.html", "app.html", "login.html", "scripts/indexnow-submit.mjs"]
});
assert.deepEqual(changedPublic, ["https://edunizam.online/"]);

const changedPrivate = buildSubmissionUrls({
  sitemapXml: sitemap,
  changedFiles: ["app.html", "login.html", "pwa-repair.html"]
});
assert.deepEqual(changedPrivate, [], "private pages must never be submitted");

const allOnSitemapChange = buildSubmissionUrls({
  sitemapXml: sitemap,
  changedFiles: ["sitemap.xml"],
  sitemapChanged: true
});
assert.equal(allOnSitemapChange.length, 18, "sitemap changes should submit the current public URL set");

console.log("IndexNow checks passed: key-file match, 18 public URLs, changed-page filtering, and private-page exclusion.");
