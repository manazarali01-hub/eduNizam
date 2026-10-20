import fs from 'node:fs';
import assert from 'node:assert/strict';

const pages = [
  { file: 'index.html', canonical: 'https://edunizam.online/' },
  { file: 'learning-resources-pakistan.html', canonical: 'https://edunizam.online/learning-resources-pakistan.html' },
  { file: 'school-management-system-pakistan.html', canonical: 'https://edunizam.online/school-management-system-pakistan.html' },
];

function attribute(html, tag, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  const selector = value ? `<meta\\b(?=[^>]*\\b${escaped}="${value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}" )[^>]*>` : '';
  if (value) {
    const exact = new RegExp(`<meta\\b(?=[^>]*\\b${escaped}="${value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}")[^>]*\\bcontent="([^"]*)"[^>]*>`, 'i');
    return html.match(exact)?.[1] ?? null;
  }
  const match = html.match(new RegExp(`<meta\\b(?=[^>]*\\b${escaped}="[^"]+")[^>]*\\bcontent="([^"]*)"[^>]*>`, 'i'));
  return match?.[1] ?? null;
}

for (const page of pages) {
  const html = fs.readFileSync(page.file, 'utf8');
  const title = html.match(/<title>([^<]+)<\\/title>/i)?.[1]?.trim();
  const description = attribute(html, 'meta', 'name', 'description');
  const canonical = html.match(/<link\\b(?=[^>]*\\brel="canonical")[^>]*\\bhref="([^"]+)"[^>]*>/i)?.[1];
  assert.ok(title, `${page.file}: missing page title`);
  assert.ok(description, `${page.file}: missing meta description`);
  assert.equal(canonical, page.canonical, `${page.file}: canonical URL mismatch`);
  assert.equal(attribute(html, 'meta', 'property', 'og:title'), title, `${page.file}: Open Graph title must match page title`);
  assert.equal(attribute(html, 'meta', 'name', 'twitter:title'), title, `${page.file}: Twitter title must match page title`);
  assert.equal(attribute(html, 'meta', 'property', 'og:description'), description, `${page.file}: Open Graph description must match meta description`);
  assert.equal(attribute(html, 'meta', 'name', 'twitter:description'), description, `${page.file}: Twitter description must match meta description`);
  console.log(`PASS ${page.file}: title, descriptions, canonical and social metadata aligned`);
}
