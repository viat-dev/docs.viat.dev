#!/usr/bin/env node
// Debug helper: screenshot one page of the built site (run `npm run build`
// and `npm run preview` first). Usage: npm run dev:shot -- <path> [out.png]

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const target = process.argv[2] ?? '/docs.viat.dev/zh-cn/instance/activation/';
const out = path.join(ROOT, '.viat', process.argv[3] ?? 'page.png');
const base = process.env.DOCS_PREVIEW_URL ?? 'http://localhost:4321';

const browser = await (async () => {
  try { return await chromium.launch(); }
  catch { return chromium.launch({ channel: 'chrome' }); }
})();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(base + target, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const tabs = page.locator('.vtabs').first();
  if (await tabs.count()) {
    await tabs.screenshot({ path: out });
    console.log(`tabs widget → ${path.relative(ROOT, out)}`);
  } else {
    await page.screenshot({ path: out });
    console.log(`full page (no .vtabs found) → ${path.relative(ROOT, out)}`);
  }
} finally {
  await browser.close();
}
