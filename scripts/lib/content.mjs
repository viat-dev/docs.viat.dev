import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { publicUrl } from './site.mjs';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const LOCALES = ['zh-cn', 'en'];
export const docsDirectory = (root = ROOT) => path.join(root, 'src/content/docs');

export async function readPages(root = ROOT) {
  const base = docsDirectory(root);
  const pages = [];
  async function walk(dir) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const absolute = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Documentation symlinks are not publishable: ${absolute}`);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.name.endsWith('.md')) {
        const relative = path.relative(base, absolute).split(path.sep).join('/');
        const [locale, ...parts] = relative.split('/');
        const { data, content } = matter(await readFile(absolute, 'utf8'));
        pages.push({ absolute, relative, locale, localPath: parts.join('/'), data, content });
      } else throw new Error(`Only allowlisted Markdown belongs in the content tree: ${absolute}`);
    }
  }
  await walk(base);
  return pages.sort((a, b) => a.relative.localeCompare(b.relative, 'en'));
}

export function pageUrl(relative) {
  if (!relative.endsWith('.md') || relative.split('/').includes('..')) throw new Error(`Invalid page path: ${relative}`);
  return '/' + relative.replace(/\.md$/, '/').replace(/(^|\/)index\/$/, '$1');
}

/** Resolve source-file links without rewriting code blocks or arbitrary URLs. */
export function resolveMarkdownLink(fromRelative, url) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url) || url.startsWith('#')) return null;
  const match = url.match(/^([^?#]+)([?#].*)?$/);
  if (!match || !match[1].endsWith('.md')) return null;
  const target = path.posix.normalize(match[1].startsWith('/')
    ? match[1].slice(1)
    : path.posix.join(path.posix.dirname(fromRelative), match[1]));
  if (!LOCALES.includes(target.split('/')[0]) || target.startsWith('../')) throw new Error(`Link escapes published locales: ${url}`);
  return { target, suffix: match[2] ?? '' };
}

export function rawMarkdown(page) {
  const info = page.locale === 'zh-cn'
    ? `核验版本：${page.data.verified_release}；通道：${page.data.channel}；文档 ID：${page.data.doc_id}`
    : `Verified release: ${page.data.verified_release}; channel: ${page.data.channel}; document ID: ${page.data.doc_id}`;
  let body = page.content.trim();
  if (page.data.doc_id?.startsWith('applications.')) {
    const id = page.data.doc_id.slice('applications.'.length);
    body += `\n\n[${page.locale === 'zh-cn' ? '完整示例文件（下载不会执行）' : 'Complete example files (download does not execute)'}](${publicUrl(`/examples/${id}/`)})`;
  }
  if (body.startsWith('# ')) {
    const end = body.indexOf('\n');
    return end < 0 ? `${body}\n\n> ${info}\n` : `${body.slice(0, end)}\n\n> ${info}\n\n${body.slice(end).trimStart()}\n`;
  }
  return `# ${page.data.title}\n\n> ${info}\n\n${body}\n`;
}

export function privacyErrors(text) {
  const errors = [];
  if (/\/Users\/[^\s]+|\/private\/var\/folders\//.test(text)) errors.push('private local path');
  if (/\b(?:vis_pat_|v(?:sk|pat|so)_)[A-Za-z0-9_-]{32,}\b|\bvsk_[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{24,}\b/.test(text)) errors.push('potential live credential');
  if (/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----\s*[A-Za-z0-9+/=\r\n]{80,}-----END/.test(text)) errors.push('private key material');
  if (/docs\/feedback\/|\b[0-9a-f]{8}-[0-9a-f]{16}\b/i.test(text)) errors.push('private feedback or device identifier');
  return errors;
}

export function pairErrors(pages) {
  const errors = [];
  const pairs = new Map();
  for (const page of pages) {
    if (!LOCALES.includes(page.locale)) { errors.push(`${page.relative}: unsupported locale`); continue; }
    for (const field of ['title', 'description', 'doc_id', 'verified_release', 'channel']) {
      if (typeof page.data[field] !== 'string' || !page.data[field].trim()) errors.push(`${page.relative}: missing ${field}`);
    }
    if (!['stable', 'preview'].includes(page.data.channel)) errors.push(`${page.relative}: invalid channel`);
    if (!/^[a-z0-9][a-z0-9_.-]+$/.test(page.data.doc_id ?? '')) errors.push(`${page.relative}: invalid doc_id`);
    if (page.data.contract_ids !== undefined && (!Array.isArray(page.data.contract_ids) || page.data.contract_ids.some((id) => typeof id !== 'string'))) errors.push(`${page.relative}: contract_ids must be a string array`);
    const key = page.data.doc_id;
    const pair = pairs.get(key) ?? new Map();
    if (pair.has(page.locale)) errors.push(`${page.relative}: duplicate ${key}/${page.locale}`);
    pair.set(page.locale, page);
    pairs.set(key, pair);
    if (!page.content.trim()) errors.push(`${page.relative}: empty body`);
    const publicText = JSON.stringify(page.data) + '\n' + page.content;
    errors.push(...privacyErrors(publicText).map((error) => `${page.relative}: ${error}`));
  }
  for (const [id, pair] of pairs) {
    if (LOCALES.some((locale) => !pair.has(locale))) { errors.push(`${id}: missing translation`); continue; }
    const a = pair.get('zh-cn'), b = pair.get('en');
    for (const field of ['verified_release', 'channel']) if (a.data[field] !== b.data[field]) errors.push(`${id}: ${field} differs by locale`);
    if (a.localPath !== b.localPath) errors.push(`${id}: locale paths differ`);
    const ids = (page) => JSON.stringify(Array.isArray(page.data.contract_ids) ? [...page.data.contract_ids].sort() : []);
    if (ids(a) !== ids(b)) errors.push(`${id}: contract coverage differs by locale`);
  }
  return errors;
}
