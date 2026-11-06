import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import { sidebar } from './scripts/lib/navigation.mjs';
import { remarkDocumentationLinks } from './scripts/lib/markdown.mjs';
import { SITE_ORIGIN, BASE_PATH } from './scripts/lib/site.mjs';

const manifest = JSON.parse(readFileSync(new URL('./contracts/manifest.json', import.meta.url), 'utf8'));

export default defineConfig({
  site: SITE_ORIGIN,
  base: BASE_PATH || '/',
  output: 'static',
  trailingSlash: 'always',
  markdown: {
    processor: unified({ remarkPlugins: [remarkDocumentationLinks] }),
  },
  integrations: [starlight({
    title: 'Viat',
    description: 'Viat product handbook / Viat 产品手册',
    defaultLocale: 'zh-cn',
    locales: {
      'zh-cn': { label: '简体中文', lang: 'zh-CN' },
      en: { label: 'English', lang: 'en' },
    },
    sidebar,
    components: { MarkdownContent: './src/components/DocContent.astro' },
    social: [{ icon: 'github', label: 'Documentation source', href: 'https://github.com/viat-dev/docs.viat.dev' }],
    lastUpdated: false,
    head: manifest.publication_ready ? [] : [{ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' } }],
  })],
});
