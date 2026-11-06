# Documentation

Markdown source for the docs published at https://gridworkz.com/docs.

- `quickstart.md`: clone GRX930 and run its tests
- `hardware/`: GRX930 CPU and memory map, NPU registers, G100, photonic tensor accelerator, board pinout
- `software/`: GRXCP

The facts here summarize the kubeworkz repositories (grx930, grxgpu, grxcp). When they change, update these pages.

The website in [`../website`](../website) builds these pages. To add a page, create a `.md` file here with a `title` in its front matter, then add it to the `sidebar` list in `website/astro.config.mjs`.

This README is not published.
