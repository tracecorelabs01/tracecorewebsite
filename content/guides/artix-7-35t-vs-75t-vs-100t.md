---
title: "35T vs 75T vs 100T DMA Cards: Which Artix-7 Board Do You Need?"
description: "Artix-7 35T vs 75T vs 100T DMA cards compared: logic cells, block RAM, published speeds, why read speed barely changes and when a bigger FPGA matters."
section: "dma"
kind: "comparison"
seo_title: "75T vs 100T DMA Card: Artix-7 35T, 75T and 100T Compared"
related_products: ["tracecore-75t", "tracecore-100t-pro", "heino-2", "thermal-kit"]
sort_order: 9
reviewed_by: "TraceCoreLab team"
---

For memory forensics and research with PCILeech or MemProcFS, a 75T DMA card is enough: the USB 3 link, not the FPGA size, sets read speed, and published figures for other 35T, 75T and 100T boards (not TraceCoreLab measurements) sit between 190 and 220 MB/s. Pick a 100T when you build your own FPGA designs and need about 34% more logic. TraceCoreLab sells the 75T and the 100T Pro; the 35T is not in the catalog.

## Short answer

- **Forensics, incident response and research:** [TraceCore 75T](/product/tracecore-75t), {{price:tracecore-75t}}.
- **FPGA designs of your own alongside DMA work:** [TraceCore 100T Pro](/product/tracecore-100t-pro), {{price:tracecore-100t-pro}}.
- **35T boards:** about the same published read speed, but less than half the logic of a 75T. TraceCoreLab does not stock one.

Use a DMA card only on computers you own or are authorized to examine.

## Comparison table

The three sizes belong to the same AMD Xilinx Artix-7 family. The FPGA figures are from AMD's 7 Series FPGAs overview, [DS180](https://docs.amd.com/v/u/en-US/ds180_7Series_Overview).

| | XC7A35T (35T) | XC7A75T (75T) | XC7A100T (100T) |
|---|---|---|---|
| Logic cells | 33,280 | 75,520 | 101,440 |
| Slices | 5,200 | 11,800 | 15,850 |
| Flip-flops | 41,600 | 94,400 | 126,800 |
| Block RAM | 1,800 Kb | 3,780 Kb | 4,860 Kb |
| DSP slices | 90 | 180 | 240 |
| Logic compared with a 75T | 44% | 100% | 134% |
| Published PCILeech read speed | 190 MB/s | 200 MB/s | 220 MB/s |

The speed row lists published figures for other boards (35T boards, CaptainDMA 75T and CaptainDMA 100T on the [pcileech-fpga](https://github.com/ufrisk/pcileech-fpga) page), not TraceCoreLab measurements.

The two TraceCore boards side by side:

| | TraceCore 75T | TraceCore 100T Pro |
|---|---|---|
| FPGA | Artix-7 XC7A75T | Artix-7 XC7A100T |
| Host interface | PCIe x1, fits x1 to x16 slots | PCIe x1, fits x1 to x16 slots |
| Data link | USB-C, USB 3 (USB 3.1 and USB 3.2 ports) | USB-C |
| Kill switch | I/O panel, enable/disable | I/O panel, enable/disable |
| Bracket | Full height or low profile | Full height or low profile |
| Price | {{price:tracecore-75t}} | {{price:tracecore-100t-pro}} |

![TraceCore 75T FPGA DMA card with a dark grey TraceCoreLab cover](/media/products/2026/11/c1b05e21801b9fa1f87d.webp)

![TraceCore 100T Pro FPGA DMA card with a silver-grey TraceCoreLab cover](/media/products/2026/11/aae170ecdaff8d78a0e4.webp)

## Why speed barely changes

Moving from a 35T to a 100T roughly triples the logic, yet published read speeds rise by only about 16%. Two links sit between target memory and your analysis workstation, and neither grows with the FPGA.

1. **PCIe x1.** PCILeech FPGA designs use one lane. At PCIe gen2 that is 5 GT/s, or about 500 MB/s in each direction before protocol overhead.
2. **The USB 3 bridge.** Data reaches the workstation through a USB 3 bridge, usually FTDI's FT601, then through the workstation's USB controller and driver. In practice this is the tighter limit.

The FPGA only has to keep up with these links, and even a 35T does. Differences between the published figures come from board and design details, not from logic count.

> [!TIP]
> Before blaming the board, check the port. If `pcileech benchmark` warns that the USB connection is most likely at USB2 speed, move the cable to a rear USB 3 port. [DMA card connection and speed test](/guides/dma-card-connection-and-speed-test) shows how to read the output.

TraceCoreLab has not yet published its own benchmark figures for the 75T and 100T Pro. [PCILeech-compatible hardware](/guides/pcileech-compatible-hardware) explains why, and how to measure your own card.

## When the bigger FPGA matters: your own designs

The extra logic in a 100T is for designs you build yourself. It helps when you:

- Develop PCIe or TLP research designs that add logic beside the PCIe core.
- Add on-chip logic analyzer cores to debug a design, which take block RAM for their sample buffers.
- Prototype hardware or signal-processing functions that need more DSP slices (240 vs 180) or more block RAM (4,860 Kb vs 3,780 Kb).
- Want headroom, so a growing design still fits and meets timing without a rewrite.

If you only run PCILeech and MemProcFS, none of this changes your results, and the 75T is the better value.

## Where is the 35T?

The 35T is the smallest of the three, with 33,280 logic cells, less than half of a 75T. Published figures for other makers' 35T boards (190 MB/s, not TraceCoreLab measurements) are close to those of larger boards for memory reads, but the small FPGA leaves little room for designs of your own. TraceCoreLab does not sell a 35T board; the 75T is the entry point of the TraceCore range.

## Cooling and the Thermal Kit

Long acquisitions and cases with little airflow keep an FPGA busy for hours. The [Thermal Kit](/product/thermal-kit) is a clip-on anodised aluminium heatsink with pre-cut 1.5 mm thermal pads, listed for the TraceCore 75T. [Install a DMA card heatsink and thermal pads](/guides/install-dma-card-thermal-kit) shows how to fit it.

The Thermal Kit is not listed for the 100T Pro. If your build needs extra cooling for that card, contact us before you order.

## Heino 2.0

[Heino 2.0](/product/heino-2) is a standalone DMA device from a third-party maker, not an Artix-7 TraceCore board, so it is not part of this comparison. TraceCoreLab sells it with a 3-month warranty. Stock is limited, so contact us for the current lead time before ordering.

## Three questions before you buy

1. **Will you only run PCILeech and MemProcFS?** Then the FPGA size does not change your results. Take the 75T.
2. **Will you build FPGA designs of your own?** Synthesize a draft design for the XC7A75T and read the utilization report. If logic or block RAM use is already high, the 100T Pro gives you room to grow.
3. **Does the target system restrict DMA?** Neither board changes what platform protections allow. Check the target's IOMMU and Kernel DMA Protection status first, as described in [DMA card compatibility](/guides/dma-card-compatibility).

## Verdict: forensics, research, FPGA development

| Your work | Pick | Why |
|---|---|---|
| Memory forensics and incident response | TraceCore 75T | The same link limits as a 100T, at a lower price |
| Security research with PCILeech | TraceCore 75T | Logic beyond the 75T does not change read speed |
| FPGA development and PCIe research designs | TraceCore 100T Pro | About 34% more logic, plus more block RAM and DSP slices |
| DMA work and your own designs on one board | TraceCore 100T Pro | Room to grow without changing boards |

Browse both in [DMA cards](/shop/dma), and see [what is a PCIe DMA card](/guides/what-is-a-pcie-dma-card) for how the hardware works.

## FAQ

### Is a 100T DMA card faster than a 75T?

Only slightly in published figures for other boards (220 vs 200 MB/s), because both sizes share the same PCIe x1 link and USB 3 bridge. The 100T's advantage is logic for your own designs.

### What do 35T, 75T and 100T mean?

They are short for the Artix-7 parts XC7A35T, XC7A75T and XC7A100T. The number roughly tracks logic cells in thousands: 33,280, 75,520 and 101,440.

### Do I need a 100T for MemProcFS?

No. MemProcFS runs on the analysis workstation and works the same way with either card; read speed depends on the link.

### Will a 75T DMA card fit an x16 slot?

Yes. TraceCore cards are PCIe x1 and fit x1, x4, x8 and x16 slots. Choose a full-height or low-profile bracket to match the case.

### Does TraceCoreLab sell a 35T?

No. The TraceCore range starts at the 75T, which has more than twice the logic of a 35T.
