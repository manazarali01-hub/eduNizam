import fs from 'node:fs';
import assert from 'node:assert/strict';

const expected = {
  'index.html': 'Organization',
  'features.html': 'CollectionPage',
  'school-management-system-pakistan.html': 'WebPage',
  'online-school-admissions.html': 'WebPage',
  'learning-resources-pakistan.html': 'CollectionPage',
  'about.html': 'AboutPage',
  'privacy.html': 'WebPage',
  'learn.html': 'CollectionPage',
  'aiou-student-resources-pakistan.html': 'WebPage',
  'virtual-university-resources-pakistan.html': 'WebPage',
  'university-results-lms-past-papers-pakistan.html': 'WebPage',
  'css-ppsc-fpsc-pakistan.html': 'WebPage',
  'pakistan-education-services.html': 'WebPage',
  'pakistan-entry-tests-scholarships.html': 'WebPage',
  'pakistan-degree-accreditation-recognition.html': 'WebPage',
  'technical-vocational-digital-skills-pakistan.html': 'WebPage',
  'pakistan-textbooks-curriculum-research.html': 'WebPage',
  'pakistan-exam-study-pathways.html': 'WebPage',
};

function nodesFor(data) {
  if (Array.isArray(data['@graph'])) return data['@graph'];
  return [data];
}

for (const [file, expectedType] of Object.entries(expected)) {
  const html = fs.readFileSync(file, 'utf8');
  const blocks = [...html.matchAll(/<script\\b[^>]*type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi)];
  assert.equal(blocks.length, 1, file + ': expected exactly one JSON-LD block');
  const data = JSON.parse(blocks[0][1]);
  assert.equal(data['@context'], 'https://schema.org', file + ': Schema.org context missing');
  const nodes = nodesFor(data);
  const types = nodes.flatMap((node) => Array.isArray(node['@type']) ? node['@type'] : [node['@type']]).filter(Boolean);
  assert.ok(types.includes(expectedType), file + ': expected ' + expectedType + ' schema');
  assert.ok(!types.includes('Article') || expectedType === 'Article', file + ': do not add generic Article schema to this page');
  const canonical = html.match(/<link\\b(?=[^>]*rel=["']canonical["'])(?=[^>]*href=["']([^"']*)["'])[^>]*>/i)?.[1];
  assert.ok(canonical, file + ': canonical URL missing');
  if (file !== 'index.html') {
    const pageNode = nodes.find((node) => node['@type'] === expectedType);
    assert.ok(pageNode?.url === canonical, file + ': schema URL must match canonical');
  } else {
    const organizations = nodes.filter((node) => node['@type'] === 'Organization' && node['@id'] === 'https://edunizam.online/#organization');
    assert.equal(organizations.length, 1, 'index.html: expected one canonical Organization entity');
    assert.ok(organizations[0].logo?.url === 'https://edunizam.online/assets/edunizam-premium-mark.svg', 'index.html: Organization logo mismatch');
  }
  console.log('PASS ' + file + ': valid JSON-LD and page-appropriate ' + expectedType);
}
