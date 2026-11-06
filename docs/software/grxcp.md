---
title: GRXCP
description: The GRX Compute Platform, CUDA-style programming for the G100 and GRX930.
sidebar: { order: 1 }
---

**GRXCP** (GRX Compute Platform) is the CUDA-class software platform for the **G100** GPU and the **GRX930** SoC. Source: [kubeworkz/grxcp](https://github.com/kubeworkz/grxcp).

:::note[In active development]
GRXCP is being built in phases and tested on the G100's SimX and RTL simulators. Its roadmap (`docs/designs/grxcp_roadmap.md`) has the status of each part.
:::

## The stack

```text
your_kernel.grx.cpp  ──grxcc──►  host ELF + .grxfat
                                     │
                                libgrxrt  (grxMalloc / grxLaunchKernel / streams / events)
                                     │
                                vortex2.h  (G100 driver API)
                                     │
                                Command processor ──► KMU ──► SMs / TCU / DXA
```

- **libgrxrt:** a CUDA-Runtime-shaped host API: devices, memory, streams, events
- **grxcc:** a single-source compiler driver for `__global__` kernels and `<<<grid, block>>>` launches, built on the [VOLT](https://github.com/vortexgpgpu/Volt) LLVM toolchain
- **Libraries:** grxBLAS, grxDNN
- **Tools:** `grx-smi`, `grx-prof`, `grx-sanitize`
- **CUDA porting:** `grx_cuda_compat.h` maps `cudaX` to `grxX`, so porting is a one-line include change

## A kernel

From `tests/grxcc/vecadd.grx.cpp`:

```cpp
#include <grx/grx.h>

__global__ void axpy(const float* x, float* y, unsigned int n, float a) {
  const unsigned int i = blockIdx.x * blockDim.x + threadIdx.x;
  if (i < n) y[i] = a * x[i] + y[i];
}

int main() {
  // ...
  grxMalloc((void**)&dx, n * sizeof(float));
  grxMalloc((void**)&dy, n * sizeof(float));
  axpy<<<grid, block>>>(dx, dy, n, alpha);
  grxDeviceSynchronize();
  grxMemcpy(got.data(), dy, n * sizeof(float), grxMemcpyDefault);
}
```

## Building

GRXCP builds with CMake and links against an **installed** grxgpu, found through `pkg-config` (`vortex-runtime`, `vortex-kernel`). Build and install [grxgpu](/docs/hardware/g100) first, then follow the build steps in the [grxcp repository](https://github.com/kubeworkz/grxcp).

## Devices

- **G100:** the primary target
- **GRX930 NPU:** a second device, reached through its [CSR interface](/docs/hardware/npu)
- **PTA:** a grxBLAS int8 GEMM route exists for the [photonic tile](/docs/hardware/pta), running against a model until hardware exists
