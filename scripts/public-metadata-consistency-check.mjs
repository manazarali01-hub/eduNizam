import fs from 'node:fs';
import assert from 'node:assert/strict';

const pages = [
  { file: 'index.html', canonical: 'https://edunizam.online/' },
  { file: 'learning-resources-pakistan.html', canonical: 'https://edunizam.online/learning-resources-pakistan.html' },
  { file: 'school-management-system-pakistan.html', canonical: 'https://edunizam.online/school-management-system-pakistan.html' },
  { file: 'features.html', canonical: 'https://edunizam.online/features.html' },
  { file: 'learn.html', canonical: 'https://edunizam.online/learn.html' },
  { file: 'aiou-student-resources-pakistan.html', canonical: 'https://edunizam.online/aiou-student-resources-pakistan.html' },
  { file: 'virtual-university-resources-pakistan.html', canonical: 'https://edunizam.online/virtual-university-resources-pakistan.html' },
  { file: 'university-results-lms-past-papers-pakistan.html', canonical: 'https://edunizam.online/university-results-lms-past-papers-pakistan.html' },
  { file: 'pakistan-education-services.html', canonical: 'https://edunizam.online/pakistan-education-services.html' },
  { file: 'pakistan-degree-accreditation-recognition.html', canonical: 'https://edunizam.online/pakistan-degree-accreditation-recognition.html' },
  { file: 'pakistan-textbooks-curriculum-research.html', canonical: 'https://edunizam.online/pakistan-textbooks-curriculum-research.html' },
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
  assert.ok(title.length <= 60, page.file + ': title exceeds 60 characters (' + title.length + ')');
  assert.ok(description.length <= 160, page.file + ': meta description exceeds 160 characters (' + description.length + ')');
  assert.equal(canonical, page.canonical, page.file + ': canonical URL mismatch');
  const ogTitle = meta(html, 'property', 'og:title');
  const ogDescription = meta(html, 'property', 'og:description');
  if (ogTitle !== null) assert.equal(ogTitle, title, page.file + ': Open Graph title must match page title');
  const twitterTitle = meta(html, 'name', 'twitter:title');
  const twitterDescription = meta(html, 'name', 'twitter:description');
  if (twitterTitle !== null) assert.equal(twitterTitle, title, page.file + ': Twitter title must match page title');
  if (twitterDescription !== null) assert.equal(twitterDescription, description, page.file + ': Twitter description must match meta description');
  if (ogDescription !== null) assert.equal(ogDescription, description, page.file + ': Open Graph description must match meta description');
  console.log('PASS ' + page.file + ': title, descriptions, canonical and social metadata aligned');
}
