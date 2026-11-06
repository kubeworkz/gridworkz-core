---
title: Gridworkz Documentation
description: GRX930 RISC-V SoC, G100 GPU, photonic tensor accelerator and the GRXCP software platform.
---

Gridworkz designs open hardware for AI research. The work lives in three repositories under [github.com/kubeworkz](https://github.com/kubeworkz):

| Repository | What it is | Status |
|---|---|---|
| [grx930](https://github.com/kubeworkz/grx930) | RISC-V SoC: 4 × RV64IMAC cores, 2 × 8×8 systolic NPUs, coherent L2, AXI4 fabric | Verified in simulation; timing closed on Artix-7 FPGA; GF180MCU test chip in progress |
| [grxgpu](https://github.com/kubeworkz/grxgpu) | G100: open RISC-V GPU built on Vortex, with tensor cores, DXA, ray tracing and graphics. Also hosts the photonic tensor accelerator (PTA) design proposals | Simulation (SimX, RTL); discovery configuration under review |
| [grxcp](https://github.com/kubeworkz/grxcp) | GRXCP: CUDA-style runtime, `grxcc` compiler, grxBLAS and tools for the G100 and GRX930 | In active development |

## Where to start

- **Run something now:** [Quickstart](/docs/quickstart). Clone grx930 and run the NPU test suite in Icarus Verilog.
- **Program the GPU:** [GRXCP](/docs/software/grxcp)
- **Read the hardware:** [RISC-V CPU and memory map](/docs/hardware/riscv64) · [NPU registers](/docs/hardware/npu) · [G100 GPU](/docs/hardware/g100) · [Photonic tensor accelerator](/docs/hardware/pta) · [Board pinout](/docs/hardware/pinout)

All three repositories are licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). Third-party tools, scripts and PDK files included in them keep their own terms.

These pages summarize the repositories. When they disagree, the repository is right.
