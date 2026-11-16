#!/usr/bin/env node
// Regenerate the handbook's console screenshots against a LOCAL instance.
//
// Prerequisites (all local and throwaway, see scripts/dev/README if added):
//   - a viat server on 127.0.0.1:8080 serving /ui/, with demo content seeded
//     (project `docs-demo`, scripts hello/summarize/syscheck, endpoints,
//     resources, schedule, runs);
//   - an optional SECOND, unactivated stack on 127.0.0.1:8081 for the
//     locked-state activation screenshots;
//   - credentials via env VIAT_DOCS_USER / VIAT_DOCS_PASSWORD (defaults match
//     the local docker run in the docs workspace).
//
// Output: public/screenshots/<locale>/<name>.png — every image shows only
// synthetic local fixtures; never point this at a real deployment.
//
// Usage: npm run dev:capture [-- --only name-filter]

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'public', 'screenshots');
const MAIN = process.env.VIAT_DOCS_URL ?? 'http://127.0.0.1:8080';
const LOCKED = process.env.VIAT_DOCS_LOCKED_URL ?? 'http://127.0.0.1:8081';
const USER = process.env.VIAT_DOCS_USER ?? 'admin@docs.local';
const PASSWORD = process.env.VIAT_DOCS_PASSWORD ?? 'docs-local-admin-5K7qv2X';
const only = (() => {
  const index = process.argv.indexOf('--only');
  return index >= 0 ? process.argv[index + 1] : '';
})();

// name → route on the main instance (locale-independent).
const TARGETS = [
  ['projects', '/ui/projects'],
  ['project-overview', '/ui/p/docs-demo/overview'],
  ['assets', '/ui/p/docs-demo/assets'],
  ['script-editor', '/ui/p/docs-demo/scripts/hello'],
  ['workflow-editor', '/ui/p/docs-demo/workflows/daily-report'],
  ['endpoints', '/ui/p/docs-demo/endpoints'],
  ['schedules', '/ui/p/docs-demo/schedules'],
  ['runs', '/ui/p/docs-demo/runs'],
  ['logs', '/ui/p/docs-demo/logs'],
  ['authorizers', '/ui/p/docs-demo/rbac/authorizers'],
  ['license', '/ui/settings/license'],
];
const LOCKED_TARGETS = [
  ['activation', '/ui/activate'],
];

const localeFor = (lang) => (lang === 'zh' ? 'zh-CN' : 'en-US');

async function shoot(page, name, route, locale, base) {
  const url = base + route;
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 }).catch(() => null);
  await page.waitForTimeout(600);
  const file = path.join(OUT, locale, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(`${response ? response.status() : 'ERR'} ${locale}/${name}.png  ${route}`);
}

const browser = await (async () => {
  try {
    return await chromium.launch();
  } catch (error) {
    console.log(`bundled chromium unavailable (${error.message.split('\n')[0]}); using installed Chrome`);
    return chromium.launch({ channel: 'chrome' });
  }
})();
try {
  for (const lang of ['zh', 'en']) {
    const locale = lang === 'zh' ? 'zh-cn' : 'en';
    await mkdir(path.join(OUT, locale), { recursive: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      locale: localeFor(lang),
    });
    // The console follows localStorage["viat.lang"] once set; seed it before
    // any UI loads so every page (and antd chrome) renders in this locale.
    await context.addInitScript((value) => {
      try { localStorage.setItem('viat.lang', value); } catch { /* ignore */ }
    }, localeFor(lang));
    const page = await context.newPage();

    // Logged-out login page first.
    if (!only || 'login'.includes(only)) await shoot(page, 'login', '/ui/login', locale, MAIN);

    // Sign in through the real form so the screenshot set reflects the UI.
    await page.goto(`${MAIN}/ui/login`, { waitUntil: 'networkidle' });
    const email = page.locator('input[type="email"], input[autocomplete*="email"], form input:not([type="password"]):not([type="hidden"])').first();
    await email.fill(USER);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.locator('button[type="submit"], form button').first().click();
    await page.waitForURL(/\/ui\/(projects|$|p\/)/, { timeout: 15_000 });
    await page.waitForTimeout(800);

    for (const [name, route] of TARGETS) {
      if (only && !name.includes(only)) continue;
      await shoot(page, name, route, locale, MAIN);
    }
    await context.close();

    // Locked (unactivated) second stack: only worth shooting once per locale
    // when it is actually up; failures here are skipped, not fatal.
    if (!only || 'activation'.includes(only)) {
      try {
        const lockedContext = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          deviceScaleFactor: 2,
          locale: localeFor(lang),
        });
        await lockedContext.addInitScript((value) => {
          try { localStorage.setItem('viat.lang', value); } catch { /* ignore */ }
        }, localeFor(lang));
        const lockedPage = await lockedContext.newPage();
        await lockedPage.goto(`${LOCKED}/ui/login`, { waitUntil: 'networkidle', timeout: 5_000 });
        const lockedEmail = lockedPage.locator('input[type="email"], input[autocomplete*="email"], form input:not([type="password"]):not([type="hidden"])').first();
        await lockedEmail.fill(USER);
        await lockedPage.locator('input[type="password"]').first().fill(PASSWORD);
        await lockedPage.locator('button[type="submit"], form button').first().click();
        await lockedPage.waitForTimeout(1_500);
        for (const [name, route] of LOCKED_TARGETS) {
          await shoot(lockedPage, name, route, locale, LOCKED);
        }
        await lockedContext.close();
      } catch (error) {
        console.log(`SKIP ${locale}/activation (locked stack not reachable: ${error.message.split('\n')[0]})`);
      }
    }
  }
} finally {
  await browser.close();
}
console.log(`Screenshots written under public/screenshots`);
