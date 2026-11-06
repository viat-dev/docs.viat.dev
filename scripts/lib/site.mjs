// Hosting can change without rewriting authored Markdown. The initial Pages
// publication is a project site; custom-domain binding is a separate action.
const site = new URL(process.env.DOCS_SITE ?? 'https://viat-dev.github.io');
if (!['https:', 'http:'].includes(site.protocol) || site.pathname !== '/' || site.search || site.hash || site.username || site.password) throw new Error('DOCS_SITE must be a credential-free HTTP(S) origin');
export const SITE_ORIGIN = site.origin;
const configuredBase = process.env.DOCS_BASE ?? '/docs.viat.dev';
if (!/^\/[a-zA-Z0-9_./-]*$/.test(configuredBase) || configuredBase.split('/').includes('..') || configuredBase.includes('//')) throw new Error('Invalid DOCS_BASE');
export const BASE_PATH = configuredBase.replace(/\/$/, '');
export function withBase(value) {
  if (value !== '' && !value.startsWith('/')) throw new Error('Expected a root-relative site path');
  if (value.startsWith('//')) throw new Error('Protocol-relative URLs are not local paths');
  return BASE_PATH + value;
}
export const publicUrl = (value) => SITE_ORIGIN + withBase(value);
export function stripBase(value) {
  if (!BASE_PATH) return value;
  if (value === BASE_PATH) return '/';
  return value.startsWith(BASE_PATH + '/') ? value.slice(BASE_PATH.length) : null;
}
