import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('index.html', 'utf8');
const headStart = html.indexOf('<head>');
const headEnd = html.indexOf('</head>');
assert.ok(headStart >= 0 && headEnd > headStart, 'Homepage head element is missing.');
const head = html.slice(headStart, headEnd);
const hint = '<link rel="preconnect" href="https://images.pexels.com" crossorigin>';
assert.ok(head.includes(hint), 'Homepage must preconnect to the origin serving its above-the-fold hero image.');
assert.ok(head.indexOf(hint) < head.indexOf('rel="stylesheet"'), 'Hero image preconnect must be declared before stylesheets.');

const heroStart = html.indexOf('<img src="https://images.pexels.com');
assert.ok(heroStart >= 0, 'Homepage hero image was not found.');
const hero = html.slice(heroStart, html.indexOf('>', heroStart) + 1);
for (const attr of ['fetchpriority="high"', 'decoding="async"', 'width="760"', 'height="720"', 'srcset=', 'sizes=']) {
  assert.ok(hero.includes(attr), 'Homepage hero image is missing performance/accessibility attribute: ' + attr);
}

const externalScripts = head.split('<script').slice(1).map((part) => '<script' + part.split('>')[0] + '>');
for (const script of externalScripts) {
  if (!script.includes('src=')) continue;
  assert.ok(script.includes(' async') || script.includes(' defer'), 'Head script must not block HTML parsing: ' + script);
}
console.log('PASS homepage performance contract: hero preconnect, responsive high-priority image and non-blocking head scripts');
