---
title: Board pinout
description: GRX930 pin assignments on the Nexys Video FPGA board.
sidebar: { order: 5 }
---

GRX930's FPGA build targets the **Digilent Nexys Video** (Artix-7 `xc7a200tfbg484-1`). These assignments come from `c930/synth_xilinx/xc7a200t_nexys_video.xdc`.

| Signal | Pin | I/O standard | Notes |
|---|---|---|---|
| `i_clk` | R4 | LVCMOS33 | 100 MHz board clock, divided to a 50 MHz core clock |
| `i_rst_n` | G4 | LVCMOS15 | Reset, active low |
| `o_uart_txd` | AA19 | LVCMOS33 | UART TX to the FTDI bridge, 115200 8N1 |
| `i_uart_rxd` | V18 | LVCMOS33 | UART RX from the FTDI bridge |
| `o_npu_busy` | T14 | LVCMOS25 | LED: NPU0 busy |
| `o_npu_done` | T15 | LVCMOS25 | LED: NPU0 done |
| `o_npu_error` | T16 | LVCMOS25 | LED: NPU0 error |
| `o_npu_irq` | U16 | LVCMOS25 | LED: NPU0 interrupt |
| `o_npu1_busy` | V15 | LVCMOS25 | LED: NPU1 busy |
| `o_npu1_done` | W16 | LVCMOS25 | LED: NPU1 done |
| `o_npu1_error` | W15 | LVCMOS25 | LED: NPU1 error |
| `o_npu1_irq` | Y13 | LVCMOS25 | LED: NPU1 interrupt |

The repo also has constraints for the Arty A7-100T (`arty_a7_100t.xdc`) and the DDR3L memory interface (`ddr3l.xdc`).
