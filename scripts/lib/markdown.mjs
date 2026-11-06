import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { visit } from 'unist-util-visit';
import matter from 'gray-matter';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { docsDirectory, pageUrl, resolveMarkdownLink } from './content.mjs';
import { withBase } from './site.mjs';

export function remarkDocumentationLinks() {
  return (tree, file) => {
    if (!file.path) return;
    const relative = path.relative(docsDirectory(), path.resolve(file.path)).split(path.sep).join('/');
    visit(tree, (node) => {
      if (!['link', 'image', 'definition'].includes(node.type)) return;
      const resolved = resolveMarkdownLink(relative, node.url);
      if (resolved) node.url = withBase(pageUrl(resolved.target) + resolved.suffix);
      else if (node.url.startsWith('/') && !node.url.startsWith('//')) node.url = withBase(node.url);
    });
  };
}

/** Use the same Markdown processor as the site for headings and AST links;
 * fenced examples are not mistaken for navigation or rewritten as prose. */
export async function inspectMarkdown(page) {
  const links = [];
  const codes = [];
  const anchors = [];
  const html = [];
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    remarkPlugins: [() => (tree) => {
      visit(tree, (node) => {
        if (['link', 'image', 'definition'].includes(node.type)) links.push({ url: node.url, position: node.position });
        if (node.type === 'code') codes.push({ lang: node.lang, meta: node.meta, value: node.value });
        if (node.type === 'html') {
          html.push({ value: node.value, position: node.position });
          for (const match of node.value.matchAll(/\bid=["']([^"']+)["']/g)) anchors.push(match[1]);
        }
      });
    }],
  });
  const rendered = await processor.render(page.content, { fileURL: pathToFileURL(page.absolute) });
  return { links, codes, anchors, html, headings: rendered.metadata.headings };
}

export async function rewriteRootLinks(page, resolve) {
  const inspection = await inspectMarkdown(page);
  let body = page.content;
  const links = inspection.links.filter((link) => link.url.startsWith('/') && !link.url.startsWith('//'));
  for (const link of links.sort((a, b) => b.position.start.offset - a.position.start.offset)) {
    const start = link.position.start.offset, end = link.position.end.offset;
    const index = body.slice(start, end).lastIndexOf(link.url);
    if (index < 0) throw new Error(`${page.relative}: cannot safely rewrite ${link.url}`);
    body = body.slice(0, start + index) + resolve(link.url) + body.slice(start + index + link.url.length);
  }
  return body;
}

/** Generated reference prose is plain Markdown, not intentional HTML. Escape
 * parser-recognized tags so array<string> and output placeholders stay visible;
 * never touch inline/fenced code, including Rust generics or literal HTML tests. */
export async function escapeGeneratedHtml(markdown) {
  const { content } = matter(markdown);
  const prefix = markdown.slice(0, markdown.length - content.length);
  const inspection = await inspectMarkdown({ content, absolute: path.join(docsDirectory(), 'generated.md') });
  let body = content;
  for (const node of inspection.html.sort((a, b) => b.position.start.offset - a.position.start.offset)) {
    const escaped = node.value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    body = body.slice(0, node.position.start.offset) + escaped + body.slice(node.position.end.offset);
  }
  return prefix + body;
}
