import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ORIGIN = "https://edunizam.online";
const SITE_HOST = "edunizam.online";
const KEY_FILE = "edunizam-indexnow-20261107-7f4a9c2d.txt";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export function parseSitemapUrls(xml) {
  const urls = [];
  for (const match of xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)) {
    const value = match[1].replaceAll("&amp;", "&").trim();
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname === SITE_HOST) urls.push(url.href);
  }
  return [...new Set(urls)];
}

export function buildSubmissionUrls({ sitemapXml, changedFiles = [], sitemapChanged = false }) {
  const sitemapUrls = parseSitemapUrls(sitemapXml);
  if (sitemapChanged) return sitemapUrls;
  const byPath = new Map(sitemapUrls.map((value) => [new URL(value).pathname, value]));
  const changedPaths = new Set(changedFiles.map((file) => file.replaceAll("\\", "/").replace(/^\.\/+/, "")));
  return [...byPath.entries()]
    .filter(([pathname]) => changedPaths.has(pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "")))
    .map(([, url]) => url);
}

function changedFilesFromGit() {
  const before = process.env.GITHUB_EVENT_BEFORE || "";
  const current = process.env.GITHUB_SHA || "HEAD";
  if (!before || /^0+$/.test(before)) return { files: [], sitemapChanged: true };
  const names = execFileSync("git", ["diff", "--name-only", before, current], { encoding: "utf8" })
    .split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  return { files: names, sitemapChanged: names.includes("sitemap.xml") };
}

async function main() {
  const key = process.env.INDEXNOW_KEY || "";
  const keyFile = resolve(KEY_FILE);
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw new Error("INDEXNOW_KEY is missing or invalid.");
  if (!existsSync(keyFile) || readFileSync(keyFile, "utf8").trim() !== key) {
    throw new Error("IndexNow key file does not match INDEXNOW_KEY.");
  }
  const sitemapXml = readFileSync("sitemap.xml", "utf8");
  const event = process.env.GITHUB_EVENT_NAME || "";
  const selection = event === "workflow_dispatch" ? { files: [], sitemapChanged: true } : changedFilesFromGit();
  const urls = buildSubmissionUrls({ sitemapXml, changedFiles: selection.files, sitemapChanged: selection.sitemapChanged });
  if (urls.length === 0) {
    console.log("No changed public sitemap URLs to submit. Private/non-sitemap pages are intentionally excluded.");
    return;
  }
  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: SITE_HOST,
      key,
      keyLocation: new URL(KEY_FILE, SITE_ORIGIN + "/").href,
      urlList: urls
    })
  });
  const responseText = await response.text();
  if (response.status !== 200 && response.status !== 202) {
    throw new Error("IndexNow submission failed with HTTP " + response.status + ": " + responseText.slice(0, 500));
  }
  console.log("IndexNow accepted HTTP " + response.status + " for " + urls.length + " public URL(s).");
  for (const url of urls) console.log("Submitted: " + url);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
