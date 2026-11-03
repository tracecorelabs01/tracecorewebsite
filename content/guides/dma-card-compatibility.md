---
title: "DMA Card Compatibility: PCIe Slots, Brackets, Laptops and Protections"
description: "Which PCIe slot a DMA card needs, low-profile brackets, laptops and M.2, and how IOMMU, VBS and Kernel DMA Protection guard a PC, with steps to check your own."
section: "dma"
kind: "guide"
seo_title: "DMA Card PCIe Slot Compatibility, Brackets and DMA Protection"
related_products: ["tracecore-75t", "tracecore-100t-pro", "thermal-kit"]
sort_order: 6
reviewed_by: "TraceCoreLab team"
---

A TraceCore DMA card is a PCIe x1 card, so it fits any x1, x4, x8 or x16 slot in a desktop target PC, and it links at x1 whichever slot you use. The analysis PC only needs a USB 3 port. Whether the card can read memory also depends on the target's platform protections: IOMMU/VT-d, virtualization-based security and Kernel DMA Protection are designed to stop exactly this kind of access, and this guide shows how an owner checks that they are on.

Use a DMA card only on computers you own or are authorized to examine.

![TraceCore 100T Pro PCIe DMA card, a Xilinx Artix-7 XC7A100T FPGA development board](/media/products/2026/11/aae170ecdaff8d78a0e4.webp)

## What you need

- The target PC's motherboard manual, to see its slot layout and any lanes shared with M.2 sockets.
- The case's slot height: full-height or low-profile.
- Administrator access on the machine whose protections you want to check.

## Slots and lanes

| Slot on the target PC | Fits a x1 card | Link the card uses |
|---|---|---|
| PCIe x1 | Yes | x1 |
| PCIe x4 | Yes | x1 |
| PCIe x8 | Yes | x1 |
| PCIe x16 | Yes | x1 |
| Open-ended x1 or x4 slot | Yes | x1 |

PCILeech FPGA designs use a single PCIe lane even on boards with more lanes available, so a longer slot never adds speed. PCIe is backward compatible, so the card works in PCIe 3.0, 4.0 and 5.0 slots, and slots wired to the CPU or to the chipset both work.

Two things can still stop a slot from working:

- **Lane sharing.** Many motherboards share lanes between a PCIe slot and an M.2 socket, and switch the slot off when the M.2 socket holds a drive. The manual lists these pairs.
- **Space.** A slot directly under a large graphics card may be blocked by its cooler. Pick a slot with room around it for airflow.

## Brackets and small cases

The [TraceCore 75T](/product/tracecore-75t) and [TraceCore 100T Pro](/product/tracecore-100t-pro) each ship with a full-height bracket fitted and a low-profile bracket in the box, and you can choose which one comes fitted when you order.

| Case type | Bracket |
|---|---|
| Standard tower or desktop | Full-height (fitted) |
| Small form factor with half-height slots | Low-profile (in the box) |

The enable switch sits on the I/O panel at the bracket end of the card on both models, so it stays reachable from the back of the case with either bracket. Small cases also run warmer: for long sessions on the 75T, the [Thermal Kit](/product/thermal-kit) adds a clip-on aluminium heatsink. The [install guide](/guides/install-a-pcie-dma-card) shows the bracket swap step by step.

## Laptops

A laptop works well as the **analysis PC**. It only needs a USB 3 port, and the 75T's USB 3 data link works in USB 3.1 and USB 3.2 ports, Gen 1 and Gen 2. A USB 2 port still connects but is far slower.

A laptop is not a practical **target PC** for these cards, because it has no PCIe expansion slot. External PCIe enclosures connect through Thunderbolt or USB4, which are hot-plug ports that Kernel DMA Protection is built to guard, and they are outside what this guide covers.

## M.2

TraceCoreLab does not sell an M.2 DMA card. M.2 sockets with an M key carry PCIe lanes, and adapters exist that turn an M.2 socket into a standard slot, but they add connectors and cable to the PCIe signal path and we cannot confirm that they work with our cards. Use a standard PCIe slot.

## Protections against DMA attacks

PCILeech reads memory over PCIe without any driver on the target. That same ability is why modern platforms limit what a PCIe device can reach. The PCILeech README notes that recent Windows and Linux versions block DMA by default where the hardware supports it. These protections are good for every machine you are responsible for, and it is worth knowing how to confirm they are active.

### IOMMU / VT-d / AMD-Vi

The IOMMU (Intel VT-d, AMD-Vi) sits between PCIe devices and system memory, and lets the operating system decide which memory each device may reach. The PCILeech README states that PCILeech does not work if the operating system uses the IOMMU/VT-d. With it active, a DMA card's reads outside its assigned memory are blocked.

### VBS and Memory integrity

Virtualization-based security (VBS) uses the hypervisor to isolate parts of Windows. Memory integrity, also called Hypervisor-enforced Code Integrity, runs on top of it. The PCILeech README says that Windows 10/11 with VBS does not work fully with PCILeech, so on these machines memory analysis is limited or fails.

### Kernel DMA Protection

[Kernel DMA Protection](https://learn.microsoft.com/en-us/windows/security/hardware-security/kernel-dma-protection-for-thunderbolt) is a Windows feature that uses the IOMMU to guard hot-plug PCIe ports such as Thunderbolt, USB4 and CFexpress.

- Devices whose drivers support memory isolation (DMA remapping) start normally.
- Devices with incompatible drivers are blocked from starting and from DMA until an authorized user signs in or unlocks the screen.
- It needs firmware support, with Intel Virtualization Technology and VT-d on in the firmware.
- It works while Windows is running; protection during boot depends on the system firmware.

### Check that your own machine is protected

On Windows:

1. Press Win+R, type `msinfo32` and press Enter.
2. In System Summary, find **Kernel DMA Protection**. "On" means the feature is active.
3. In the same list, find **Virtualization-based security**. "Running" means VBS is active.
4. Open **Windows Security**, then **Device security**, then **Core isolation details**. Check that **Memory integrity** is on. A **Memory access protection** section appears there when Kernel DMA Protection is active.

On Linux, as root:

```
dmesg | grep -i -e DMAR -e IOMMU
ls /sys/kernel/iommu_groups
```

Lines such as "DMAR: IOMMU enabled" (Intel) or "AMD-Vi" messages, and a non-empty `iommu_groups` folder, show that an IOMMU is active.

> [!TIP]
> If a check shows a protection as off on a machine you are responsible for, look at the firmware and Windows Security settings with your IT team. These protections cost little and guard against hostile hardware.

## When protections block an examination

If a target's protections stop the card from reading memory, the platform is working as designed, not failing. Do not change a machine's security settings to make an examination work. Instead:

- Under the same authorization, acquire memory with a software acquisition method run on the machine by its owner or administrator, then analyse the dump with MemProcFS, which also opens memory dump files.
- Record that the platform was protected as part of your notes and chain of custody.

The [troubleshooting guide](/guides/dma-card-troubleshooting) shows how protection-related failures look in PCILeech, and [what is a PCIe DMA card](/guides/what-is-a-pcie-dma-card) explains where DMA cards fit in memory forensics and incident response.

## AMD memory maps

On some AMD targets, out-of-range reads while memory ranges are probed stop DMA until the card is power-cycled. A memory map (`-memmap physmemmap.txt`) built with Microsoft Sysinternals RAMMap or taken from MemProcFS avoids this. The [troubleshooting guide](/guides/dma-card-troubleshooting#amd-systems-memory-maps) has the steps, and [live memory forensics with MemProcFS](/guides/memprocfs-live-memory-forensics) covers the analysis side.

## FAQ

### Can a PCIe x1 card go in a x16 slot?

Yes. A x1 card fits and works in any longer slot. The DMA card links at x1 whichever slot you use.

### Does a DMA card work in a laptop?

A laptop works as the analysis PC through a USB 3 port. It cannot be the target PC, because laptops have no PCIe expansion slot.

### Is there an M.2 version of the TraceCore DMA card?

No. TraceCore cards are PCIe x1 add-in cards with full-height and low-profile brackets. We cannot confirm that M.2-to-PCIe adapters work with them.

### How do I check if Kernel DMA Protection is on?

Run `msinfo32` and read the Kernel DMA Protection line in System Summary. Windows Security also shows a Memory access protection section under Core isolation details when it is active.

### Why can't PCILeech read memory on a machine with VT-d?

With the IOMMU in use, the operating system limits which memory each PCIe device may reach, and the card's reads are blocked. That is the protection working as designed.
