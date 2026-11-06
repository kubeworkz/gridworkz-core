import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

// Docs live in the repo-root docs/ folder, next to the RTL and SDK they describe.
// They are served at gridworkz.com/docs/...
export const collections = {
  docs: defineCollection({
    loader: glob({ base: '..', pattern: ['docs/**/[^_]*.{md,mdx}', '!docs/README.md'] }),
    schema: docsSchema(),
  }),
};
