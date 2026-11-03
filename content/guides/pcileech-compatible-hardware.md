---
title: "PCILeech-Compatible Hardware: What It Means and How to Check It"
description: "What PCILeech-compatible means for an FPGA DMA card, how to check a card with pcileech probe and benchmark, and published speed figures for other boards."
section: "dma"
kind: "guide"
seo_title: "PCILeech-Compatible Hardware: FPGA DMA Cards Explained"
related_products: ["tracecore-75t", "tracecore-100t-pro", "dma-mini-pc"]
sort_order: 8
reviewed_by: "TraceCoreLab team"
---

PCILeech-compatible hardware is a PCIe device that PCILeech can use to read and write a target system's memory by DMA. Today that mostly means an Artix-7 FPGA board running a PCILeech FPGA design, connected to the analysis workstation over a USB 3 bridge. The label describes the hardware interface; it does not mean the PCILeech project lists, tests or endorses a board.

## What PCILeech is

[PCILeech](https://github.com/ufrisk/pcileech) is an open-source tool by Ulf Frisk that uses PCIe hardware to read and write target memory by direct memory access, with no drivers on the target. It works through the [LeechCore](https://github.com/ufrisk/LeechCore) library, which also powers [MemProcFS](https://github.com/ufrisk/MemProcFS) for browsing memory as files and folders. Typical work is memory forensics, incident response, security research and PCIe debugging. Use a DMA card only on computers you own or are authorized to examine.

For the basics of how the hardware works, start with [what is a PCIe DMA card](/guides/what-is-a-pcie-dma-card).

## What "compatible" means

A card is PCILeech-compatible when LeechCore can open it as an FPGA device and run memory reads through it. In practice that comes down to four things.

| Requirement | What it means |
|---|---|
| PCILeech FPGA design | The FPGA runs a design that speaks the protocol of the [pcileech-fpga](https://github.com/ufrisk/pcileech-fpga) project. |
| USB 3 bridge | Data reaches the analysis workstation through an FT601 bridge, using FTDI's D3XX driver. |
| PCIe x1 link | PCILeech FPGA designs use one lane, even on boards with more. |
| 64-bit memory and TLP access | FPGA hardware can reach all 64-bit memory and send raw PCIe TLPs. |

What the label does not mean:

- **No official listing.** TraceCore boards are not listed or endorsed by the PCILeech project. "PCILeech-compatible" is our description of the hardware interface.
- **No speed rating.** Compatibility says the card works with the software, not how fast it reads.
- **No promise for every target.** An active IOMMU, virtualization-based security or Kernel DMA Protection on the target limits any DMA card. [DMA card compatibility](/guides/dma-card-compatibility) explains how to check their status.

> [!NOTE]
> When you run PCILeech without naming a device, it tries an FPGA device first, then a USB3380 device.

## How to check a card yourself

### What you need

- The DMA card installed in a PCIe slot of the target system, with its kill switch set to enabled.
- An analysis workstation with a USB 3 port, preferably on the rear of the motherboard. The [DMA Mini PC](/product/dma-mini-pc) is one option.
- The latest PCILeech release from GitHub, and the FT601 driver from Windows Update or FTDI's [D3XX driver page](https://ftdichip.com/drivers/d3xx-drivers/).
- The USB cable supplied with the card.

### Steps

1. Connect the card's USB-C port to a USB 3 port on the analysis workstation, then power on the target.
2. Open Device Manager on the workstation. A working driver shows "FTDI FT601 USB 3.0 Bridge Device" under Universal Serial Bus devices. "FTDI SuperSpeed-FIFO Bridge" under Other devices means the driver is missing; see [FT601 driver and PCILeech setup](/guides/ft601-driver-and-pcileech-setup).
3. Run `pcileech probe -v`. A good result starts with a DEVICE line that names the FPGA, its PCIe generation and link width, then lists the readable memory ranges.
4. Run `pcileech benchmark`. It reads at physical address 0x1000 in block sizes from 8 bytes to 16 MB, for five seconds each.
5. Optionally, run `memprocfs.exe -device fpga` to mount the target's memory as drive M:.

The verbose device line follows this format:

```
DEVICE: FPGA: <name> PCIe gen<g> x<w> [<rd>,<wr>,<probe>] [v<maj>.<min>,<devid>]
```

### Reading the result

| Message | Likely cause |
|---|---|
| `DEVICE: FPGA: ERROR: Unable to connect to FPGA device` | The USB cable, driver or DLL on the analysis workstation |
| `Unable to configure FT601 pipe timeouts` | A problem with the FT601 driver |
| `Unable to retrieve required Device PCIe ID` | The target has not enumerated the card: check the slot, power and kill switch |
| `WARNING! Read speed is slow. USB connection most likely at USB2 speed` | 16 MB reads under 45 MB/s: move to a rear USB 3 port or change the cable |

[DMA card connection and speed test](/guides/dma-card-connection-and-speed-test) goes through each result in more detail, and [DMA card troubleshooting](/guides/dma-card-troubleshooting) covers the fixes.

## What we test on TraceCore boards

Every [TraceCore 75T](/product/tracecore-75t) and [TraceCore 100T Pro](/product/tracecore-100t-pro) is tested in the TraceCoreLab lab before dispatch. The 75T's USB-C USB 3 data link works in USB 3.1 and USB 3.2 ports, Gen 1 and Gen 2.

We do not publish a MB/s rating for TraceCore boards until we can show the benchmark output behind it, together with the PCILeech version and platform used. Until then, the most useful number is the one from your own `pcileech benchmark` run on your own hardware.

> [!TIP]
> Run the benchmark twice: once on a rear motherboard port and once on a front-panel or hub port. A large gap between the two points at the port or cable, not the card.

## Published figures for other boards

These are published figures for other boards, not TraceCoreLab measurements. They come from the pcileech-fpga project page.

| Board | FPGA | Link | Published speed |
|---|---|---|---|
| CaptainDMA 75T | XC7A75T | PCIe gen2 x1, USB-C | 200 MB/s |
| CaptainDMA 100T | XC7A100T | PCIe gen2 x1, USB-C | 220 MB/s |
| Enigma X1 | Artix-7 75T | USB-C | 200 MB/s |
| 35T boards | Artix-7 35T | USB-C | 190 MB/s |

The spread is small because every board shares the same limits: a PCIe x1 link and a USB 3 bridge. A bigger FPGA adds logic, not bandwidth. [Artix-7 35T vs 75T vs 100T](/guides/artix-7-35t-vs-75t-vs-100t) explains when the extra logic matters.

## FPGA vs USB3380 devices

PCILeech supports two hardware families. FPGA boards are the current one and the family TraceCore boards belong to.

| | FPGA devices | USB3380 devices |
|---|---|---|
| Hardware | Artix-7 FPGA board with a USB 3 bridge | Boards built on the USB3380 chip |
| Memory reach | All 64-bit memory | The first 4 GB natively |
| Raw PCIe TLP access | Yes | Not listed |
| Order PCILeech tries them in | First | Second |

## Windows vs Linux throughput

PCILeech runs on both systems. An older statement in the PCILeech README put FPGA throughput at about 150 MB/s on Windows and about 90 MB/s on Linux. Treat those as older published figures, not TraceCoreLab measurements, and benchmark your own workstation.

| | Windows | Linux |
|---|---|---|
| USB driver | FT601 driver from Windows Update, or FTDI D3XX | libusb with the FT601 driver bundled with LeechCore, normally run as root |
| FTDI library | 64-bit FTDI DLL next to `pcileech.exe` | Included with LeechCore |
| PCILeech mount | Available (needs Dokany) | Not available |
| Asynchronous read modes | Available | Not available |

## FAQ

### Is the TraceCore 75T supported by the PCILeech project?

No. The TraceCore 75T is PCILeech-compatible, meaning it works as a PCILeech FPGA device, but the PCILeech project does not list or endorse TraceCore boards.

### Which driver does a PCILeech FPGA card need?

On Windows, the FT601 driver, which usually installs from Windows Update, plus the 64-bit FTDI DLL next to `pcileech.exe`. On Linux, libusb and the FT601 driver bundled with LeechCore.

### How fast is a PCILeech-compatible card?

Published figures for comparable Artix-7 boards range from 190 to 220 MB/s; those are other boards, not TraceCoreLab measurements. Run `pcileech benchmark` to measure your own card.

### What does the USB2 speed warning mean?

`pcileech benchmark` prints it when 16 MB reads fall under 45 MB/s. The link is most likely running at USB 2 speed, so move to a rear USB 3 port and use the supplied cable.

### Does a bigger FPGA make PCILeech faster?

Not noticeably. The PCIe x1 link and the USB 3 bridge set the speed; the extra logic helps FPGA designs of your own.

Browse PCILeech-compatible boards in [DMA cards](/shop/dma).
