import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = path.resolve(ROOT, '.' + pathname);
    if (!file.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(file, (error, bytes) => {
      if (error) {
        res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(bytes);
    });
  } catch {
    res.writeHead(400).end('Bad request');
  }
});

const port = await new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
let browser;
try {
  const moduleUrl = process.env.PLAYWRIGHT_MODULE || pathToFileURL('/tmp/edunizam-pw/node_modules/playwright/index.mjs').href;
  const { chromium } = await import(moduleUrl);
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  page.setDefaultTimeout(10000);
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') route.continue();
    else route.abort();
  });

  await page.goto('http://127.0.0.1:' + port + '/learn.html#vu', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() =>
    !!document.querySelector('#vuExplorerQuery') &&
    document.querySelectorAll('#vuExplorerCourseList option').length > 0,
    null,
    { timeout: 20000 }
  );

  const candidate = await page.evaluate(() => {
    const values = [...document.querySelectorAll('#vuExplorerCourseList option')].map(option => option.value);
    return values.find(code => /^[A-Z]{2,5}\d{3,4}[A-Z]?$/i.test(code)) || '';
  });
  if (!candidate) throw new Error('Loaded VU course catalogue has no valid course-code fixture.');

  const parts = candidate.match(/^([A-Z]{2,5})(\d{3,4}[A-Z]?)$/i);
  if (!parts) throw new Error('Could not construct a hyphenated fixture from ' + candidate);
  const hyphenated = parts[1] + ' - ' + parts[2];

  await page.locator('#vuExplorerQuery').fill(' ' + hyphenated + ' ');
  await page.locator('#vuExplorerSearchBtn').click();
  await page.waitForFunction(code =>
    (document.getElementById('vuExplorerSummary')?.textContent || '').includes('Course matched: ' + code),
    candidate,
    { timeout: 10000 }
  );
  const validResult = await page.locator('#vuExplorerSummary').textContent();
  if (!validResult?.includes('Course matched: ' + candidate)) {
    throw new Error('Hyphenated course code did not resolve to the exact catalogue course.');
  }
  console.log('VU guest search PASS: ' + JSON.stringify({ input: hyphenated, matched: candidate }));

  await page.locator('#vuExplorerQuery').fill('CS-ABC');
  await page.locator('#vuExplorerSearchBtn').click();
  await page.waitForTimeout(150);
  const invalidResult = await page.locator('#vuExplorerSummary').textContent();
  if (invalidResult?.includes('Course matched:')) {
    throw new Error('Invalid non-numeric course code was incorrectly treated as a catalogue course.');
  }
  console.log('VU invalid-code guard PASS: CS-ABC was not accepted as a course code.');
} finally {
  if (browser) await browser.close().catch(() => {});
  server.closeAllConnections?.();
  await new Promise(resolve => server.close(resolve));
}
