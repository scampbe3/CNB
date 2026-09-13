import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { out } from './lib.mjs';
import { startPreview } from './preview.mjs';

const server = await startPreview(4180);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  for (const [key, id] of [['homepage', 'hero'], ['homepage', 'business-counsel'],
    ['work-with-amanda', 'business-counsel'], ['speaking-education', 'teaching-philosophy'],
    ['membership', 'hero'], ['member-home', 'hero']]) {
    await page.goto(`http://127.0.0.1:4180/preview/${key}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.CNB_LAST_CONTENT_DATA);
    const section = page.locator('#' + id);
    await section.scrollIntoViewIfNeeded();
    await page.evaluate(async () => { await Promise.all([...document.images].map(i => { i.loading = 'eager'; return i.decode().catch(() => {}); })); });
    await page.waitForTimeout(800);
    await section.screenshot({ path: path.join(out, `qa/detail-${key}-${id}.png`) });
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
