<p align="center">
  <b>G R I D W O R K Z</b><br>
  <i>Open Silicon. No NDAs.</i>
</p>

<p align="center">
  <a href="https://gridworkz.com">Website</a> ·
  <a href="https://gridworkz.com/docs">Docs</a> ·
  <a href="https://gridworkz.com/build-log">Build log</a> ·
  <a href="https://github.com/kubeworkz">Hardware on GitHub</a>
</p>

---

# Gridworkz

Gridworkz is a fabless chip company with a team of one: founder Dave Cook, working with AI agents, building open hardware for AI research. This repository holds the **[gridworkz.com](https://gridworkz.com) website and its documentation**.

## Where the hardware lives

The hardware and software are in three repositories under **[github.com/kubeworkz](https://github.com/kubeworkz)**:

| Repository | What it is | Status |
|---|---|---|
| **[grx930](https://github.com/kubeworkz/grx930)** | RISC-V SoC: 4 × RV64IMAC cores, 2 × 8×8 systolic NPUs (INT4 to BF16), coherent L2, AXI4 fabric | Verified in simulation; timing closed on Artix-7 at ~121 MHz; GF180MCU test chip in progress |
| **[grxgpu](https://github.com/kubeworkz/grxgpu)** | G100: open RISC-V GPU on Vortex with tensor cores, DXA, ray tracing and graphics, plus the photonic tensor accelerator (PTA) design proposals | Simulation; discovery configuration under review |
| **[grxcp](https://github.com/kubeworkz/grxcp)** | GRXCP: CUDA-style runtime, `grxcc` compiler, grxBLAS and tools for the G100 and GRX930 | In active development |

All three are licensed under the **[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)**: use, modify, fork and tape out, with no royalties. Third-party tools, scripts and PDK files included in those repos keep their own terms.

### Try it in a minute

```bash
sudo apt install iverilog
git clone https://github.com/kubeworkz/grx930.git
cd grx930/c930
make npu
```

## This repository

```text
gridworkz-core/
├── website/   # gridworkz.com (Astro + Starlight), deployed by Netlify
├── docs/      # Docs pages in Markdown, served at gridworkz.com/docs
└── netlify.toml
```

See [`website/README.md`](website/README.md) to run the site locally, and [`docs/README.md`](docs/README.md) to add a docs page.

## Contributing

Fixes to the site and docs are welcome here. See [CONTRIBUTING.md](CONTRIBUTING.md). Hardware and software changes belong in the kubeworkz repositories above.
