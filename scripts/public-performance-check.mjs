import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('index.html', 'utf8');
const head = html.match(/<head>([\\s\\S]*?)<\\/head>/i)?.[1] ?? '';
const hint = '<link rel="preconnect" href="https://images.pexels.com" crossorigin>';
assert.ok(head.includes(hint), 'Homepage must preconnect to the origin serving its above-the-fold hero image.');
assert.ok(head.indexOf(hint) < head.indexOf('rel="stylesheet"'), 'Hero image preconnect must be declared before stylesheets.');
const hero = html.match(/<img[^>]+src="https:\\/\\/images\\.pexels\\.com[^>]+>/i)?.[0] ?? '';
assert.ok(hero, 'Homepage hero image was not found.');
for (const attr of ['fetchpriority="high"', 'decoding="async"', 'width="760"', 'height="720"', 'srcset=', 'sizes=']) {
  assert.ok(hero.includes(attr), 'Homepage hero image is missing performance/accessibility attribute: ' + attr);
}
const externalScripts = [...head.matchAll(/<script\\b[^>]+src=["'][^"']+["'][^>]*>/gi)].map((match) => match[0]);
for (const script of externalScripts) {
  assert.ok(/\\b(?:async|defer)\\b/i.test(script), 'Head script must not block HTML parsing: ' + script);
}
console.log('PASS homepage performance contract: hero preconnect, responsive high-priority image and non-blocking head scripts');
