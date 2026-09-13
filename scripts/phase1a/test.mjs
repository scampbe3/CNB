import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { chromium } from 'playwright-core';
import { root, out, columns, csv, parseCsv, readJson, writeJson, rendererParser, rowKey } from './lib.mjs';
import { pages, downloads } from './content.mjs';
import { startPreview } from './preview.mjs';

const require = createRequire(import.meta.url);
const sharp = require(process.env.CNB_SHARP || 'D:/CNB/phase1a-tools/node_modules/sharp');
const convert = await rendererParser();
const baseline = await readJson(path.join(out, 'baseline.json'));
const manifest = await readJson(path.join(out, 'image-manifest.json'));
const patch = await readJson(path.join(out, 'sheet-patch.json'));
assert.equal(patch.workbook, baseline.workbook);
const report = { testedAt: new Date().toISOString(), pages: [], images: manifest.length, replacements: manifest.filter(m => m.replaced).length };
const safetyFiles = ['js/cnb-homepage.js', 'js/cnb-loader.js', 'js/cnb-site-footer.js'];
for (const file of safetyFiles) {
  const original = execFileSync('git', ['show', `ffc1fd5:${file}`], { cwd: root });
  assert.equal((await fs.readFile(path.join(root, file), 'utf8')).replaceAll('\r\n', '\n'), original.toString().replaceAll('\r\n', '\n'), file);
}
const homepageCss = await fs.readFile(path.join(root, 'css/cnb-homepage.css'), 'utf8');
for (const rule of [
  '#experience-television .cnb-home-image img',
  '#experience-global-marketing .cnb-home-image img',
  '#experience-entrepreneurship .cnb-home-image img',
  '#experience-teaching .cnb-home-image img',
  '#blind-dinners .cnb-home-image img',
  '#business-counsel .cnb-home-image',
  '#strategic-partnership .cnb-home-image',
]) {
  assert.ok(homepageCss.includes(rule), `Missing homepage image adjustment: ${rule}`);
}
for (const tab of baseline.tabs.filter(t => !pages.some(p => p.key === t.key))) {
  for (const suffix of ['.json', '-content-table.csv']) {
    const file = `data/cnb-${tab.key}${suffix}`;
    assert.equal((await fs.readFile(path.join(root, file), 'utf8')).replaceAll('\r\n', '\n'),
      execFileSync('git', ['show', `ffc1fd5:${file}`], { cwd: root }).toString().replaceAll('\r\n', '\n'), `Protected file ${file}`);
  }
}
for (const item of manifest) {
  const meta = await sharp(path.join(root, item.output)).metadata();
  assert.equal(meta.width, item.width); assert.equal(meta.height, item.height);
  if (item.replaced) {
    const old = await sharp(path.join(root, item.replaced)).metadata();
    assert.equal(meta.width, old.width, item.output); assert.equal(meta.height, old.height, item.output);
  }
  assert.ok(item.bytes < 1500000, `Oversized web asset: ${item.output}`);
}
for (const [source, dest] of downloads) {
  const staged = await fs.readFile(path.join(root, 'assets/docs/phase1a', dest));
  const original = await fs.readFile(path.join(process.env.CNB_FINALS || 'D:/CNB/docs/finals', source));
  assert.equal(staged.subarray(0, 5).toString(), '%PDF-');
  assert.equal(crypto.createHash('sha256').update(staged).digest('hex'), crypto.createHash('sha256').update(original).digest('hex'), 'Download PDF preserved');
}
for (const spec of pages) {
  const rows = await readJson(path.join(out, `proposed/${spec.key}.json`));
  const base = await readJson(path.join(root, `data/cnb-${spec.key}.json`));
  const staged = convert(base, rows);
  assert.deepEqual(parseCsv(csv(rows)), rows, 'CSV round trip');
  assert.equal(new Set(staged.sections.map(s => s.id)).size, staged.sections.length, 'Unique sections');
  const active = base.sections.filter(s => s.enabled !== false);
  assert.equal(staged.sections.length, active.length, `No duplicate custom sections on ${spec.key}`);
  const tab = baseline.tabs.find(t => t.key === spec.key);
  if (tab) {
    assert.deepEqual(rows.slice(0, tab.rows.length).map(rowKey), tab.rows.map(rowKey), 'Original A/B identities and order preserved');
    assert.deepEqual(base.header, tab.base.header, 'Navigation unchanged');
    for (const before of tab.base.sections) {
      const after = base.sections.find(s => s.id === before.id);
      for (const key of ['type', 'layout', 'theme', 'mobileInlineImageAfter', 'inlineImageAfter']) {
        assert.equal(after[key], before[key], `Layout preserved ${spec.key}/${before.id}/${key}`);
      }
    }
  }
  assert.ok(!JSON.stringify(staged).includes('last.b'));
  assert.ok(!JSON.stringify(staged).includes("We'll replace this"));
}

const server = await startPreview(4179);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
await fs.mkdir(path.join(out, 'qa'), { recursive: true });
try {
  for (const spec of pages) {
    const entry = { key: spec.key, viewports: [] };
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`http://127.0.0.1:4179/preview/${spec.key}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.CNB_LAST_CONTENT_DATA);
      const expected = (await readJson(path.join(root, `data/cnb-${spec.key}.json`))).sections.filter(s => s.enabled !== false);
      assert.equal(await page.locator('.cnb-home-section').count(), expected.length, 'Rendered section count');
      for (const section of await page.locator('.cnb-home-section').all()) {
        await section.scrollIntoViewIfNeeded();
        await page.waitForTimeout(70);
        assert.ok(await section.evaluate(node => node.classList.contains('is-visible')), `Section reveal ${spec.key}/${width}`);
      }
      await page.evaluate(async () => {
        await Promise.all([...document.images].map(img => { img.loading = 'eager'; return img.decode().catch(() => {}); }));
      });
      const broken = await page.locator('img').evaluateAll(imgs => imgs.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src));
      assert.deepEqual(broken, [], `Broken images on ${spec.key}`);
      assert.deepEqual(errors, [], `Runtime errors on ${spec.key}`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `Horizontal overflow ${spec.key}/${width}`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(out, `qa/${spec.key}-${width}.png`), fullPage: true });
      const text = await page.locator('[data-cnb-home-root]').innerText();
      const csvIds = await page.locator('.cnb-home-section').evaluateAll(nodes => nodes.map(n => n.id));
      await page.goto(`http://127.0.0.1:4179/preview/${spec.key}?fallback=1`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.CNB_LAST_CONTENT_DATA);
      assert.equal(await page.locator('[data-cnb-home-root]').innerText(), text, `Fallback text parity ${spec.key}`);
      assert.deepEqual(await page.locator('.cnb-home-section').evaluateAll(nodes => nodes.map(n => n.id)), csvIds, 'Fallback section ordering');
      if (spec.key === 'member-home') {
        assert.equal(await page.locator('input[type="password"],input[type="file"],form').count(), 0);
        assert.ok(text.includes('public preview'));
      }
      entry.viewports.push({ width, sections: expected.length, errors: errors.length, brokenImages: broken.length, fallbackParity: true });
      await page.close();
    }
    report.pages.push(entry);
    console.log(`PASS ${spec.key}: desktop/mobile, CSV/fallback, images, layout`);
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
report.totalSourceBytes = manifest.reduce((n, m) => n + m.sourceBytes, 0);
report.totalOutputBytes = manifest.reduce((n, m) => n + m.bytes, 0);
await writeJson(path.join(out, 'qa-report.json'), report);
console.log(JSON.stringify(report, null, 2));
