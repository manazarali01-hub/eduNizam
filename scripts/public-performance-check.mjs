import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('index.html', 'utf8');
const headStart = html.indexOf('<head>');
const headEnd = html.indexOf('</head>');
assert.ok(headStart >= 0 && headEnd > headStart, 'Homepage head element is missing.');
const head = html.slice(headStart, headEnd);
assert.ok(!head.includes('<link rel="preconnect" href="https://images.pexels.com"'), 'Unused remote hero image preconnect should not remain.');

const heroStart = html.indexOf('<img src="assets/themes/digital-learning.svg"');
assert.ok(heroStart >= 0, 'Homepage local hero image was not found.');
const hero = html.slice(heroStart, html.indexOf('>', heroStart) + 1);
for (const attr of ['fetchpriority="high"', 'decoding="async"', 'width="1200"', 'height="900"', 'alt="Digital learning illustration representing the EduNizam student experience"']) {
  assert.ok(hero.includes(attr), 'Homepage hero image is missing performance/accessibility attribute: ' + attr);
}
assert.ok(fs.existsSync('assets/themes/digital-learning.svg'), 'Homepage local hero image asset is missing from the repository.');

const externalScripts = head.split('<script').slice(1).map((part) => '<script' + part.split('>')[0] + '>');
for (const script of externalScripts) {
  if (!script.includes('src=')) continue;
  assert.ok(script.includes(' async') || script.includes(' defer'), 'Head script must not block HTML parsing: ' + script);
}
console.log('PASS homepage performance contract: local high-priority hero asset and non-blocking head scripts');
