---
title: GRX930 CPU and memory map
description: Quad-core RV64IMAC CPU subsystem and the GRX930 memory map.
sidebar: { order: 1 }
---

The GRX930 has four **RV64IMAC** cores on a 4-master AXI4 crossbar with a shared L2. Source: [`grx930/rv64imac/RTL`](https://github.com/kubeworkz/grx930/tree/main/rv64imac/RTL).

## Core

- **Pipeline:** 5-stage, in-order
- **ISA:** RV64IMAC: integer, multiply/divide (Booth multiplier, non-restoring divider), atomics, compressed
- **Atomics:** full AMO / LR / SC support
- **I-cache:** 4 KB direct-mapped, 256-bit lines, AXI4 burst reads
- **D-cache:** 4 KB direct-mapped, write-back with byte strobes
- **Hazard unit:** 3-stage forwarding, stall-on-use for loads, CSR flush on exceptions
- **MMIO:** AXI4-Lite bridge for uncached peripheral access

## L2 cache

- 4-way set-associative, write-back
- 32 to 512 sets (32 for FPGA fit, 512 for simulation)
- Invalidation-based coherence with 8 L1 invalidation ports

## Memory map

| Address | Size | Region |
|---|---|---|
| `0x0000_0000 – 0x0000_03FF` | 1 KB | Boot ROM (reset vector and firmware) |
| `0x0000_1000 – 0x0000_FFFF` | 60 KB | DDR stub: code, data and NPU buffers |
| `0x4000_0000` | | NPU CSRs (see [NPU registers](/docs/hardware/npu)) |
| `0x4000_1000 – 0x4000_100F` | 16 B | UART |
| `0x4000_2000 – 0x4000_200F` | 16 B | Timer (`mtime` / `mtimecmp`) |
| `0x4000_3000 – 0x4000_300F` | 16 B | GPIO |
| `0x4000_4000 – 0x4000_4FFF` | 4 KB | APLIC interrupt controller |
| `0x8000_0000 – 0xFFFF_FFFF` | 2 GB | External DDR (ASIC only) |

Source: `c930/doc/c930_full_soc_architecture.md` §3.3.

## FPGA results

On the Nexys Video (`xc7a200tfbg484-1`): **~121 MHz** post-implementation (WNS +7.883 ns, 0 failing endpoints), using 125,735 LUTs (94%), 67,007 FFs, 55 BRAM and 227 DSP.
