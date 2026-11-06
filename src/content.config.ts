import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

export const collections = {
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
  docs: defineCollection({
    // Keep protocol identifiers such as http_api and for_each stable across
    // website URLs, source links, raw Markdown and offline chapter paths.
    loader: docsLoader({ generateId: ({ entry }) => entry.replace(/\\/g, '/').replace(/\.md$/, '') }),
    schema: docsSchema({
      extend: z.object({
        doc_id: z.string().regex(/^[a-z0-9][a-z0-9_.-]+$/),
        verified_release: z.string(),
        channel: z.enum(['stable', 'preview']),
        contract_ids: z.array(z.string()).default([]),
      }),
    }),
  }),
};
