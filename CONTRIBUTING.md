# Contributing to gridworkz-core

This repository holds the **gridworkz.com website and its docs**. Fixes and improvements are welcome: broken links, outdated specs, clearer docs, layout bugs.

**Hardware and software changes go in the kubeworkz repositories:**

| Repository | For |
|---|---|
| [kubeworkz/grx930](https://github.com/kubeworkz/grx930) | GRX930 RISC-V SoC and NPU: RTL, testbenches, FPGA flow |
| [kubeworkz/grxgpu](https://github.com/kubeworkz/grxgpu) | G100 GPU and photonic tensor accelerator proposals |
| [kubeworkz/grxcp](https://github.com/kubeworkz/grxcp) | GRXCP runtime, compiler and libraries |

## What's here

- `website/`: the site (Astro + Starlight). Run it with `cd website && npm install && npm run dev`. Needs Node 24.
- `docs/`: docs pages in Markdown, served at gridworkz.com/docs. See [`docs/README.md`](docs/README.md) to add a page.

## Making a change

1. **Fork the repository** and branch off `main`, e.g. `docs/npu-register-fix` or `site/mobile-nav`.
2. **Build it:** `npm run build` in `website/` must pass. Check changed pages at desktop and phone widths.
3. **Open a pull request** against `main`. Merges to `main` deploy to gridworkz.com automatically.

## Specs and claims

Every technical fact on the site should trace to a source in grx930, grxgpu or grxcp. If you change a spec, link that source in your pull request. Keep status words honest: "verified in simulation", "timing closed", "in progress" and "in design" mean different things.

## Sign-off

Sign off your commits with `-s`:

```bash
git commit -s -m "docs: fix NPU1 CSR offset"
```

This adds `Signed-off-by: Your Name <your@email.com>`, certifying under the [Developer Certificate of Origin](https://developercertificate.org/) that you have the right to submit the work under this repository's license.
