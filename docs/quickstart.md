---
title: Quickstart
description: Clone GRX930 and run its NPU test suite in an open-source simulator.
---

The GRX930 SoC simulates with **Icarus Verilog**, a free, open-source simulator. No EDA license is needed.

## Prerequisites

```bash
sudo apt install iverilog python3
```

The firmware tests also need a RISC-V GCC toolchain (`riscv64-unknown-elf-gcc`).

## Clone and run

```bash
git clone https://github.com/kubeworkz/grx930.git
cd grx930/c930
make npu
```

`make npu` runs the NPU integer GEMM tests across all matrix sizes. It takes about a minute.

## More test targets

| Target | What it runs | Time |
|---|---|---|
| `make npu` | NPU integer GEMM, all matrix sizes | ~1 min |
| `make npu_float` | NPU FP16 / BF16 GEMM | ~2 min |
| `make hazard` | CPU hazard unit: CSR flush, stalls | ~30 s |
| `make hazard_equiv` | Hazard unit equivalence, 300K cycles | ~5 min |
| `make arb_equiv` | DMA arbiter equivalence, 1,200+ transactions | ~3 min |
| `make soc` | Full SoC with firmware, 11 tests | ~10 min |
| `make soc_full` | Full SoC with DDR and all peripherals | ~15 min |
| `make quad` | Quad-core coherency | ~10 min |
| `make l2_coherent` | L2 cache coherence | ~10 min |

## Build for an FPGA

The FPGA flow targets the **Nexys Video** board (Artix-7 `xc7a200tfbg484-1`) and uses Vivado:

```bash
cd grx930/c930
make vivado_synth
```

See the [board pinout](/docs/hardware/pinout) and the [grx930 README](https://github.com/kubeworkz/grx930#fpga-build) for programming the board.

## The G100 GPU

The G100 has its own build and simulators. See [G100 GPU](/docs/hardware/g100).
