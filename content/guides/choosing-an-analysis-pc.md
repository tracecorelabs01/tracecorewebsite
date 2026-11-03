---
title: "Choosing an Analysis Workstation for PCILeech and MemProcFS"
description: "What a PCILeech analysis PC needs for an FPGA DMA card: native USB 3 ports, 64-bit Windows, storage for memory images, laptop tips and DMA Mini PC first boot."
section: "dma"
kind: "guide"
seo_title: "PCILeech Analysis PC: Choosing a Forensic Workstation"
related_products: ["dma-mini-pc", "usb-c-data-cable", "tracecore-75t"]
sort_order: 10
reviewed_by: "TraceCoreLab team"
---

The analysis workstation is the computer that runs PCILeech and MemProcFS and receives data from an FPGA DMA card over its USB 3 data link. It needs a native USB 3 port, 64-bit Windows for the best FPGA throughput, and enough storage to hold a memory image as large as the target's RAM. Most modern desktops, laptops and mini PCs qualify; the [DMA Mini PC](/product/dma-mini-pc) is a compact workstation built for the job.

> [!NOTE]
> Use a DMA card only on computers you own or are authorized to examine.

## Why analysis runs on its own workstation

A PCIe DMA card is installed in the target system, the computer whose memory you examine. Drivers, PCILeech, MemProcFS, case files and memory images all live on the analysis workstation, for four reasons:

- **Evidence integrity.** Installing tools or writing files on the target changes the memory and disk you are examining. The card reads memory without drivers on the target, so the target stays as you found it.
- **Reliability.** A target under investigation may be unstable or compromised; your tools stay on hardware you control.
- **A known toolset.** Recorded tool versions make results repeatable and easy to document.
- **Secure storage.** Memory images hold passwords and keys, so they belong on an encrypted drive you manage.

## Must-haves

| Requirement | Why it matters |
|---|---|
| Native USB 3 port on the motherboard | Carries the card's data link. The 75T works in USB 3.1 and USB 3.2 (Gen 1 and Gen 2) ports |
| No hub, dock or front-panel extension | Each adds a controller, shared bandwidth and power limits. Rear motherboard ports are the safest choice |
| 64-bit Windows 10 or 11 | Best FPGA throughput, and the mount features use Dokany on Windows |
| Administrator rights | Needed to install the FT601 driver and Dokany |
| 8 GB RAM or more | Enough for PCILeech and MemProcFS; forensic mode on large images runs faster with more |
| Encrypted storage with room for images | See the next section |

A USB 2 port still enumerates the card but runs far slower, and `pcileech benchmark` warns when reads fall under 45 MB/s. An older PCILeech README statement gives about 150 MB/s on Windows against about 90 MB/s on Linux for FPGA devices: published figures for PCILeech FPGA hardware in general, not TraceCoreLab measurements. Linux works too (libusb, usually as root), but the PCILeech mount command is Windows-only.

## Storage for memory images

A full memory image is roughly the size of the target's RAM. Plan for at least twice that: the original image, a working copy, and room for forensic mode output.

| Target RAM | Image size (approx.) | Free space to plan |
|---|---|---|
| 16 GB | 16 GB | 40 GB |
| 32 GB | 32 GB | 80 GB |
| 64 GB | 64 GB | 160 GB |

Keep the operating system and tools on the internal drive and case images on a separate encrypted SSD, with the DMA card and the evidence drive on different ports.

## Laptops

A laptop makes a good portable analysis workstation if you:

1. Confirm the port is USB 3. Some budget laptops have USB-C ports that run at USB 2 speed; check the specification sheet.
2. Plug the card into the laptop's own port, not a dock, hub or monitor.
3. Run on mains power. In Windows power options, set sleep to Never while plugged in and turn off USB selective suspend, so Windows does not power down the port mid-transfer.
4. Keep images on an encrypted external SSD.

## The DMA Mini PC

The [DMA Mini PC](/product/dma-mini-pc) ({{price:dma-mini-pc}}) is a compact desktop for use as the analysis workstation, giving PCILeech, MemProcFS and your other tools their own hardware.

| Spec | DMA Mini PC |
|---|---|
| CPU | AMD Ryzen 5 3500U (4 cores, 8 threads) |
| Memory | 8 GB |
| Storage | 128 GB M.2 SSD |
| USB | 3 x USB 3.2 |
| Display outputs | 2 x HDMI |
| Wireless | Wi-Fi 5 |

Use one USB 3.2 port for the card, one for an encrypted evidence SSD, and the third for a keyboard and mouse (a combined wireless receiver needs one port). The 128 GB SSD holds the operating system, tools and small images.

### First boot and updates

1. Connect a display to either HDMI output, plus a keyboard and mouse, and power on.
2. Set up 64-bit Windows 10 or 11 and install all updates through Windows Update.
3. Connect the DMA card's data cable to a USB 3.2 port. Windows Update normally installs the FT601 driver on first connection, and Device Manager should then list "FTDI FT601 USB 3.0 Bridge Device".
4. Download PCILeech and MemProcFS from their official GitHub release pages ([PCILeech](https://github.com/ufrisk/pcileech), [MemProcFS](https://github.com/ufrisk/MemProcFS)), add the FTDI DLL and install Dokany v2, as described in [FT601 driver and PCILeech setup](/guides/ft601-driver-and-pcileech-setup).
5. In Windows power options, set sleep to Never and turn off USB selective suspend.
6. Turn on drive encryption if your Windows edition supports it.
7. Run the [connection and speed test](/guides/dma-card-connection-and-speed-test) and save the output.
8. Write down the Windows build and every tool version in a workstation log.

> [!TIP]
> Keep the workstation dedicated: fewer unrelated programs means a cleaner record of what touched your evidence.

## Checklist

- [ ] Native USB 3 port free for the card, no hub or dock
- [ ] 64-bit Windows 10 or 11, fully updated
- [ ] FT601 driver shows as "FTDI FT601 USB 3.0 Bridge Device"
- [ ] PCILeech, MemProcFS, FTDI DLL and Dokany v2 installed from official sources
- [ ] Sleep and USB selective suspend off
- [ ] Encrypted evidence drive with at least twice the target's RAM free
- [ ] Connection and speed test passed and saved
- [ ] Tool versions recorded

Once the workstation passes the checklist, [MemProcFS live memory forensics](/guides/memprocfs-live-memory-forensics) walks through the first analysis session. Other workstation accessories are on the [accessories page](/shop/accessory).

## FAQ

### Can I use a laptop as the analysis workstation?

Yes, if it has a native USB 3 port and runs on mains power. Avoid docks and hubs, and turn off sleep and USB selective suspend.

### Does the analysis workstation have to run Windows?

No, but Windows is recommended. PCILeech reports higher FPGA throughput on Windows, and its mount command is Windows-only; Linux works with libusb, usually as root.

### Can I connect the DMA card through a USB hub or dock?

It is best not to. Hubs and docks add a controller and can drop the link to USB 2 speed.

### Which cable should I use between the card and the workstation?

The USB-C 3.0 cable in the box (1 m) is enough for most desks. For more reach, the [USB-C 3.2 Data Cable](/product/usb-c-data-cable) comes in 2 m and 3 m lengths and is rated USB 3.2 Gen 2.

### Is 128 GB of storage on the DMA Mini PC enough?

For the operating system, tools and small images, yes. A full image is about the size of the target's RAM, so keep larger images on an encrypted external SSD.
