// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://gridworkz.com',
  integrations: [
    starlight({
      title: 'Gridworkz Docs',
      // The site has its own 404 page featuring Via (src/pages/404.astro).
      disable404Route: true,
      logo: { src: './src/assets/logo-mark.svg', alt: 'Gridworkz' },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/tokens.css', './src/styles/starlight.css'],
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/kubeworkz' }],
      // Add new docs pages here (docs live in the repo-root docs/ folder).
      sidebar: [
        { label: 'Start here', items: [{ label: 'Overview', slug: 'docs' }, 'docs/quickstart'] },
        { label: 'Hardware', items: ['docs/hardware/riscv64', 'docs/hardware/npu', 'docs/hardware/g100', 'docs/hardware/pta', 'docs/hardware/pinout'] },
        { label: 'Software', items: ['docs/software/grxcp'] },
      ],
    }),
    sitemap(),
  ],
});
