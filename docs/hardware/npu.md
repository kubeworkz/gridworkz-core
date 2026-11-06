---
title: GRX930 NPU registers
description: Dual 8×8 systolic GEMM NPUs and their CSR map.
sidebar: { order: 2 }
---

The GRX930 has two NPUs. Each is an **8×8 systolic-array GEMM engine** with its own AXI4 DMA, a command queue of depth 4, a pipelined FP32 → FP16 normalize stage and a sigmoid/tanh activation unit. Source: [`grx930/c930/rtl`](https://github.com/kubeworkz/grx930/tree/main/c930/rtl) (`c930_npu_*.sv`); driver: `c930/sw/c930_npu_driver.c`.

## CSR map

NPU0's registers start at `0x4000_0000` (AXI4-Lite). NPU1's window is at offset `0x040`.

| Offset | Register | Access | Description |
|---|---|---|---|
| `0x00` | `CTRL` | W | bit 0 `START`: push a command to the queue |
| `0x04` | `STATUS` | R | bit 0 `BUSY`, bit 1 `DONE` (latched), bit 2 `ERROR` |
| `0x08` | `DIM_M` | RW | Output rows |
| `0x0C` | `DIM_N` | RW | Output columns |
| `0x10` | `DIM_K` | RW | Reduction length |
| `0x14` | `A_BASE` | RW | A matrix base address |
| `0x18` | `B_BASE` | RW | B matrix base address |
| `0x1C` | `C_BASE` | RW | C matrix base address |
| `0x20` | `PREC` | RW | bits [2:0]: precision (below) |
| `0x24` | `CYCLE_LO` | R | Free-running cycle counter |
| `0x28` | `DMA_LAST` | R | Cycle count latched from the last completed GEMM |
| `0x2C` | `OP_COUNT` | R | MAC operations completed |
| `0x30` | `STALL_CT` | R | Stall cycles |
| `0x34` | `DMA_CT` | R | DMA busy cycles (live) |
| `0x38` | `QUEUE_STAT` | R | bits [3:0] occupancy, bit 4 full |
| `0x3C` | `QUEUE_MAX` | R | Queue depth (compile-time) |

Source: header comment of `c930/rtl/c930_npu_csr.sv`.

## Precision codes (`PREC`)

| Value | Format |
|---|---|
| 0 | INT8 |
| 1 | INT16 |
| 2 | FP16 |
| 3 | BF16 |
| 4 | INT4 |

## Limits

| Parameter | GRX930 SoC build | Core default |
|---|---|---|
| Systolic array | 8 × 8 PEs | `NUM_ROWS` × `NUM_COLS` = 8 × 8 |
| Max M (output rows) | **8** | 64 |
| Max N (output columns) | **12** | 8 |
| Max K (reduction length) | **16** | 256 |
| Command queue depth | 4 | 4 |
| Accumulator | 48-bit; C holds the low 32 bits (INT32, or FP32 in the float modes) | |

The SoC values come from `c930/rtl/c930_soc_top.sv` and match the driver's `NPU_MAX_*` in `c930/sw/c930_npu_driver.h`. A START with dimensions outside them sets `ERROR`.

## Memory layout

A (M×K) and B (K×N) are row-major and packed into 32-bit words, little-endian: 4 elements per word at INT8, 2 at INT16, FP16 and BF16, 8 at INT4. C (M×N) is row-major, one 32-bit word per element. Addresses must be word-aligned.

Try it in the [NPU register playground](/playground/npu-registers) or watch the dataflow in the [systolic array visualizer](/playground/systolic).

## Verification

An 18-case shape and precision sweep (INT8, INT16, FP16, BF16, INT4 across 10 M×N×K shapes) passes on the Verilated SoC. Run the integer and float suites yourself with `make npu` and `make npu_float` (see [Quickstart](/docs/quickstart)).
