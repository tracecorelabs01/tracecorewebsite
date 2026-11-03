---
title: "What Is a PCIe DMA Card? FPGA Boards, PCILeech and Memory Forensics"
description: "A PCIe DMA card is an FPGA board that reads a computer's memory over PCIe for forensics and research. How it works, the software, its uses and its limits."
section: "dma"
kind: "guide"
seo_title: "What Is a DMA Card? PCIe FPGA Boards for Memory Forensics"
related_products: ["tracecore-75t", "tracecore-100t-pro", "heino-2", "dma-mini-pc"]
sort_order: 1
reviewed_by: "TraceCoreLab team"
---

A PCIe DMA card is an expansion card, usually built on an FPGA, that reads and writes a computer's memory directly over the PCIe bus without running any software on that computer. It passes the data over USB to a separate analysis workstation, where open-source tools such as PCILeech and MemProcFS turn raw memory into something you can examine. DMA cards are used for memory forensics, incident response, security research and FPGA development.

## The short answer

DMA stands for direct memory access. It is how PCIe devices such as network cards and NVMe drives move data to and from system memory without the CPU copying every byte. A DMA card uses the same mechanism on purpose: installed in a target system, it performs memory reads and writes on request from another computer, so you can capture and inspect live memory from outside the operating system.

| Part | Role |
|---|---|
| Target system | The computer being examined. The DMA card sits in one of its PCIe slots. |
| DMA card | An FPGA board that acts as a PCIe device and performs the memory reads and writes. |
| USB 3 data link | Carries requests and memory data between the card and the analysis workstation. |
| Analysis workstation | A separate computer that runs PCILeech, MemProcFS and your analysis tools. |

## How a DMA card works

### PCIe bus mastering

On PCIe, a device that is allowed to act as a bus master can send its own memory read and write requests to the host. These requests travel as transaction layer packets (TLPs). A storage controller uses bus mastering to place disk data straight into RAM; a DMA card uses it to fetch whichever physical addresses the analysis workstation asks for.

According to the [PCILeech README](https://github.com/ufrisk/pcileech), this works with no drivers installed on the target. FPGA-based hardware can reach all 64-bit memory and send raw PCIe TLPs, which also makes it useful for studying PCIe itself.

### The Artix-7 FPGA and the USB 3 bridge

Most current DMA cards are built around a Xilinx Artix-7 FPGA, which has a PCIe block built in. The FPGA design makes the board appear as a PCIe device and moves data between the PCIe side and a USB 3 bridge chip, most often FTDI's FT601 on [PCILeech FPGA](https://github.com/ufrisk/pcileech-fpga) boards. Those designs link at PCIe x1, even on boards with more lanes, so a typical card fits any x1, x4, x8 or x16 slot.

The FPGA size (35T, 75T or 100T) sets how much logic the board has for its design. It has little effect on read speed, which the USB link limits. [Artix-7 35T vs 75T vs 100T](/guides/artix-7-35t-vs-75t-vs-100t) covers the difference in detail.

![TraceCore 75T FPGA DMA card with a dark grey TraceCoreLab cover and a PCIe x1 edge connector](/media/products/2026/11/c1b05e21801b9fa1f87d.webp)

### Target system and analysis workstation

A DMA card always works between two computers. The card goes into the target. A USB cable runs from the card to the analysis workstation, which runs the software and stores what you capture. Keeping the tools on separate hardware means the acquisition does not install anything on, or depend on, the system under examination. A laptop with a USB 3 port works as the workstation; the [DMA Mini PC](/product/dma-mini-pc) is a small dedicated option.

TraceCore cards also have a kill switch on the I/O panel. It enables or disables the card without unplugging it, so the card can stay installed and cabled between sessions.

## The software: PCILeech, LeechCore, MemProcFS

Three open-source projects by Ulf Frisk do most of the work on the analysis workstation.

| Tool | What it does |
|---|---|
| [PCILeech](https://github.com/ufrisk/pcileech) | Command-line tool to read, write and display target memory, and to test the card with `pcileech probe` and `pcileech benchmark`. |
| [LeechCore](https://github.com/ufrisk/LeechCore) | The library that talks to the hardware, including FPGA cards over the FT601 USB link. |
| [MemProcFS](https://github.com/ufrisk/MemProcFS) | Presents physical memory as files and folders, such as processes, modules and registry, so you can browse live memory with ordinary tools. |

A first check on a new card usually runs these three commands on the analysis workstation:

```
pcileech probe -v
pcileech benchmark
memprocfs.exe -device fpga
```

On Windows the FT601 driver normally installs from Windows Update the first time the card connects, with FTDI's D3XX package as the fallback. [FT601 driver and PCILeech setup](/guides/ft601-driver-and-pcileech-setup) walks through it, and [MemProcFS live memory forensics](/guides/memprocfs-live-memory-forensics) covers the analysis side.

> [!NOTE]
> "PCILeech-compatible" describes the hardware interface: the card works as a PCILeech FPGA device. It is not an endorsement by the PCILeech project. [PCILeech-compatible hardware](/guides/pcileech-compatible-hardware) explains what the label covers.

## Legitimate uses: forensics, research, FPGA development

### Memory forensics and incident response

RAM holds evidence that never reaches disk: running processes, loaded modules, open network connections and encryption keys in use. A DMA card captures it without installing an acquisition agent on the target, which limits how much the collection changes the system you are examining. MemProcFS can then analyse the live system or a saved capture.

### Security research

Researchers use DMA cards to test how platforms and drivers handle DMA from PCIe devices: whether IOMMU protection is active, which memory a device can reach, and how hot-plug ports such as Thunderbolt are protected. The results feed into hardening decisions for real systems.

### Hardware debugging and FPGA development

Raw TLP access makes a DMA card a practical tool for studying PCIe behaviour, and an Artix-7 board is a capable FPGA development platform for designs of your own. Larger FPGAs give those designs more room.

## What protects systems from DMA

Modern platforms limit what a PCIe device can read. These protections are why a DMA card may return no data on one system and work on another.

| Protection | What it does | How to check it |
|---|---|---|
| IOMMU (Intel VT-d, AMD-Vi) | The OS maps which memory each device may reach. PCILeech cannot read memory by DMA when the OS uses it. | Windows: `msinfo32`. Linux: look for DMAR or AMD-Vi lines in `dmesg`. |
| Virtualization-based security (VBS) | Isolates parts of the OS with the hypervisor. The PCILeech README says DMA does not work fully with it. | `msinfo32`, "Virtualization-based security" line |
| Kernel DMA Protection | Windows uses the IOMMU to block DMA from hot-plug PCIe devices (Thunderbolt, USB4, CFexpress) whose drivers do not support DMA remapping. | `msinfo32`, "Kernel DMA Protection" line |

### How to check protection status on Windows

1. Press Win + R, type `msinfo32` and press Enter.
2. In System Summary, find the "Kernel DMA Protection" and "Virtualization-based security" lines.
3. Alternatively, open Windows Security, then Device security, then Core isolation details, and look for "Memory access protection".

Microsoft's [Kernel DMA Protection documentation](https://learn.microsoft.com/en-us/windows/security/hardware-security/kernel-dma-protection-for-thunderbolt) notes that the feature needs VT-d (IOMMU) enabled in firmware and does not protect during boot. Recent Windows and Linux versions also restrict DMA by default.

> [!WARNING]
> TraceCoreLab guides explain these protections from the defender's side and how to check their status. They do not cover changing them.

## Choosing a board

For PCILeech and MemProcFS work, the board matters less than the link. Speeds listed on the pcileech-fpga page for comparable Artix-7 boards range from 190 MB/s (35T boards) to 220 MB/s (a 100T board). These are published figures for other boards, not TraceCoreLab measurements.

| | [TraceCore 75T](/product/tracecore-75t) | [TraceCore 100T Pro](/product/tracecore-100t-pro) |
|---|---|---|
| FPGA | Artix-7 XC7A75T | Artix-7 XC7A100T |
| Logic cells | 75,520 | 101,440 |
| Host interface | PCIe x1 | PCIe x1 |
| Data link | USB-C, USB 3 | USB-C |
| Kill switch | I/O panel | I/O panel |
| Best for | Forensics and research | Larger FPGA designs of your own |

[Heino 2.0](/product/heino-2) is a standalone DMA device from a third-party maker; contact us for the current lead time. Compare every board in [DMA cards](/shop/dma), check slots, brackets and laptops in [DMA card compatibility](/guides/dma-card-compatibility), and fit your card with [how to install a PCIe DMA card](/guides/install-a-pcie-dma-card).

## Authorized use and data handling

Use a DMA card only on computers you own or are authorized to examine. For client or employer systems, get written authorization that names the systems and the scope of the work before you connect anything.

Memory captures hold passwords, keys, messages and personal data. Treat them as sensitive evidence:

- Store captures on encrypted storage and limit who can open them.
- Record chain of custody: who acquired the capture, when, from which system, and its hash.
- Keep captures only as long as the case or project needs them, then delete them securely.

## FAQ

### What is a DMA card used for?

Memory forensics, incident response, security research and FPGA development. It captures live memory from a target system over PCIe without installing software on it.

### Does a DMA card need software on the target computer?

No. PCILeech reads memory over PCIe with no drivers on the target. The software and the USB driver run on the analysis workstation.

### Do I need a separate analysis computer?

Yes. The card sits in the target system and connects over USB to another computer that runs PCILeech or MemProcFS. A laptop with a USB 3 port works.

### Is a 100T DMA card faster than a 75T?

Not by much for memory reads, because the USB link sets the speed. The 100T's extra logic matters for FPGA designs of your own.

### Why does a DMA card read nothing on some systems?

An active IOMMU, virtualization-based security or Kernel DMA Protection limits what a PCIe device can reach. Check their status with `msinfo32`, then see [DMA card troubleshooting](/guides/dma-card-troubleshooting).

Terms used in this guide are defined in the [glossary](/guides/glossary#dma-and-pcie).
