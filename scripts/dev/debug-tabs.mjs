import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { remarkViatTabs } from '../../scripts/lib/tabs-remark.mjs';
import { unified } from '@astrojs/markdown-remark';

const processor = await createMarkdownProcessor({ syntaxHighlight: false, remarkPlugins: [remarkViatTabs] });
const rendered = await processor.render(':::tabs id=ways\n::tab Console\n\nOpen **New**.\n\n::tab CLI\n\n```sh\nviat --version\n```\n:::\n', {});
console.log('=== rendered ===');
console.log(rendered.code);
