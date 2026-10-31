import fs from 'node:fs';
import assert from 'node:assert/strict';

const pages = [
  { file: 'index.html', canonical: 'https://edunizam.online/' },
  { file: 'learning-resources-pakistan.html', canonical: 'https://edunizam.online/learning-resources-pakistan.html' },
  { file: 'school-management-system-pakistan.html', canonical: 'https://edunizam.online/school-management-system-pakistan.html' },
];

function meta(html, key, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find((item) => item.includes(key + '="' + value + '"'));
  return tag?.match(/\bcontent="([^"]*)"/i)?.[1] ?? null;
}

const homeHtml = fs.readFileSync('index.html', 'utf8');
const jsonLdBlock = homeHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1];
assert.ok(jsonLdBlock, 'index.html: missing JSON-LD block');
const structuredData = JSON.parse(jsonLdBlock);
assert.ok(structuredData['@graph']?.some((node) => node['@type'] === 'Organization' && node['@id'] === 'https://edunizam.online/#organization'), 'index.html: missing canonical Organization entity');
assert.ok(structuredData['@graph'].some((node) => node['@type'] === 'Organization' && node.logo?.url === 'https://edunizam.online/assets/edunizam-premium-mark.svg'), 'index.html: Organization logo URL missing or incorrect');

for (const page of pages) {
  const html = fs.readFileSync(page.file, 'utf8');
  const title = html.split('<title>')[1]?.split('</title>')[0]?.trim();
  const description = meta(html, 'name', 'description');
  const canonicalTag = html.match(/<link\b[^>]*rel="canonical"[^>]*>/i)?.[0];
  const canonical = canonicalTag?.match(/\bhref="([^"]+)"/i)?.[1];
  assert.ok(title, page.file + ': missing page title');
  assert.ok(description, page.file + ': missing meta description');
  assert.equal(canonical, page.canonical, page.file + ': canonical URL mismatch');
  assert.equal(meta(html, 'property', 'og:title'), title, page.file + ': Open Graph title must match page title');
  assert.equal(meta(html, 'name', 'twitter:title'), title, page.file + ': Twitter title must match page title');
  assert.equal(meta(html, 'property', 'og:description'), description, page.file + ': Open Graph description must match meta description');
  assert.equal(meta(html, 'name', 'twitter:description'), description, page.file + ': Twitter description must match meta description');
  console.log('PASS ' + page.file + ': title, descriptions, canonical and social metadata aligned');
}
