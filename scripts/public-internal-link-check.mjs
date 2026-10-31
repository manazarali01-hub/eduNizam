import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const origin = 'https://edunizam.online';
const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
const publicUrls = [...sitemap.matchAll(/<loc>(https:\/\/edunizam\.online[^<]*)<\/loc>/gi)].map((match) => match[1]);
assert.ok(publicUrls.length > 0, 'sitemap.xml: no public URLs found');

const publicFiles = publicUrls.map((value) => {
  const url = new URL(value);
  const pathname = decodeURIComponent(url.pathname);
  return { url, file: pathname === '/' ? 'index.html' : pathname.replace(/^\//, '') };
});
const publicFileSet = new Set(publicFiles.map((item) => item.file));
const incoming = new Map(publicFiles.map((item) => [item.file, new Set()]));
let checkedLinks = 0;

for (const page of publicFiles) {
  assert.ok(fs.existsSync(page.file), page.file + ': sitemap URL does not map to a repository file');
  const html = fs.readFileSync(page.file, 'utf8');
  const links = html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi);

  for (const match of links) {
    const href = match[2].trim();
    if (!href || /^(?:#|https?:|mailto:|tel:|javascript:|data:)/i.test(href)) continue;

    let target;
    try {
      target = new URL(href, page.url);
    } catch {
      assert.fail(page.file + ': malformed internal link: ' + href);
    }
    if (target.origin !== origin) continue;

    let targetPath = decodeURIComponent(target.pathname);
    if (targetPath.endsWith('/')) targetPath += 'index.html';
    const targetFile = targetPath.replace(/^\//, '');
    if (!/\.html?$/i.test(targetFile)) continue;

    checkedLinks += 1;
    assert.ok(fs.existsSync(targetFile), page.file + ': broken internal link "' + href + '" -> ' + targetFile);
    if (incoming.has(targetFile)) incoming.get(targetFile).add(page.file);
  }
}

for (const file of publicFileSet) {
  const sources = incoming.get(file);
  assert.ok(sources.size > 0, file + ': public sitemap page has no internal incoming links');
  console.log('PASS ' + file + ': ' + sources.size + ' linking public page(s)');
}

console.log('PASS internal-link integrity: ' + publicFiles.length + ' sitemap pages and ' + checkedLinks + ' local HTML links checked');
