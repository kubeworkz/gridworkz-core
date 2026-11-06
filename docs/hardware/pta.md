---
title: Photonic tensor accelerator
description: The PTA, a photonic GEMM tile in design as a chiplet beside the G100.
sidebar: { order: 4 }
---

:::caution[In design]
The PTA has no hardware yet. Everything on this page is a design proposal or a model result.
:::

The **photonic tensor accelerator (PTA)** is a photonic matrix-multiply tile, planned as a chiplet of its own beside the G100 and reached over a die-to-die link, with a copy engine feeding it from device memory.

## Where it stands

- **Tile:** 128 × 64.
- **Error model:** the tile is modelled before it is built. Its output error is measured against a frozen test network (an MNIST classifier pooled to 8 × 8, whose last layer runs on the tile). The harness is `c930/sim/pta_mnist.c` in grx930; the design note is `c930/doc/pta_error_model_design_note.md`.
- **Acceptance band:** the frozen canary (manifest revision 1.0) sets the targets: rms error between 2.5% and 7.3% with a fixed output scale, 98.5% class agreement, and at most 16 of 16,000 outputs off by 17 or more converter codes.
- **Host path:** a proposal to expose the chiplet's registers to the G100's command processor as a DCR range, with a GEMM submitted as one command.

## Software

GRXCP has a driver for the chiplet's register map and a grxBLAS route that sends an int8 GEMM to the tile. Today these run against a model; no device is enumerated until the hardware path exists.

## Read the proposals

In [`grxgpu/docs/proposals`](https://github.com/kubeworkz/grxgpu/tree/main/docs/proposals):

- `pta_chiplet_host_path.md`: registers as a DCR range, a GEMM as one command
- `pta_weight_set_policies.md`: how weights are loaded and kept
- `first_board_pta_note.md`: the PTA against the first board's accuracy gate
