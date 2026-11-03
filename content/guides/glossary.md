---
title: "Glossary: DMA Card, Video Fuser and USB Passthrough Terms"
description: "Plain definitions of DMA card, FPGA and PCIe terms, video fuser and display signal terms such as EDID and pixel clock, and USB passthrough and polling terms."
section: "reference"
kind: "glossary"
seo_title: "DMA Card, FPGA, Video Fuser and USB Passthrough Glossary"
related_products: []
sort_order: 22
reviewed_by: "TraceCoreLab team"
---

This glossary defines the technical terms used in TraceCoreLab's hardware guides. It has three separate sections, one per product family: DMA cards and FPGA, video fusers and display signals, and USB input passthrough. Each entry links only to guides and products in its own family; the [guides hub](/guides) lists every guide by section.

## DMA cards and FPGA

Terms for PCIe DMA cards used in memory forensics, incident response, security research and FPGA development. Start with [what is a PCIe DMA card](/guides/what-is-a-pcie-dma-card), or browse the [DMA cards](/shop/dma).

### Analysis workstation

The computer that runs PCILeech and MemProcFS and connects to the DMA card's USB 3 data port. It stores case output and memory images, keeping tools and evidence off the target system. It needs a native USB 3 port; 64-bit Windows gives the best FPGA throughput. See [choosing an analysis PC](/guides/choosing-an-analysis-pc).

### Artix-7

AMD's (formerly Xilinx) cost-optimised 7 Series FPGA family. TraceCore cards use the XC7A75T (75,520 logic cells) and the XC7A100T (101,440 logic cells); the smaller XC7A35T has 33,280. More logic matters for your own FPGA designs, not for PCILeech read speed. Compare the three in [35T vs 75T vs 100T](/guides/artix-7-35t-vs-75t-vs-100t).

### Bus mastering

A PCIe device's ability to start its own memory reads and writes instead of waiting for the CPU. Network cards, NVMe drives and graphics cards rely on it, and a DMA card uses it to read the target system's memory. Firmware or the operating system turns it on per device.

### Direct memory access (DMA)

A way for hardware to read or write system memory directly, without the CPU copying each byte. Network cards and NVMe drives move data this way, and a PCIe DMA card uses the same mechanism to read a target system's physical memory.

### DMA card (PCIe DMA card)

An FPGA board that installs in a PCIe slot of the target system, reads its physical memory by direct memory access, and sends the data over a USB 3 link to an analysis workstation. It is used for memory forensics, incident response, security research and FPGA development. See [what is a PCIe DMA card](/guides/what-is-a-pcie-dma-card).

### Enable switch

A switch on the I/O panel (the bracket end) of the TraceCore 75T and 100T Pro that enables or disables the card without unplugging it or opening the case. With the card disabled, reads return nothing, so check the switch first when a connection test reads only zeros. See [DMA card troubleshooting](/guides/dma-card-troubleshooting).

### FPGA

Field-programmable gate array: a chip whose logic is set by a design loaded into it, not fixed at the factory. On a DMA card, the FPGA design implements the PCIe device and moves data between PCIe and the USB bridge. The same board can also host your own designs for PCIe and hardware research.

### FT601

FTDI's USB 3 to FIFO bridge chip, used on PCILeech FPGA boards such as the TraceCore 75T to carry data between the FPGA and the analysis workstation. On Windows it uses FTDI's D3XX driver and appears in Device Manager as "FTDI FT601 USB 3.0 Bridge Device". See [FT601 driver and PCILeech setup](/guides/ft601-driver-and-pcileech-setup).

### IOMMU / VT-d

An input-output memory management unit controls which memory addresses each device may reach, as the CPU's MMU does for programs. Intel calls it VT-d and AMD calls it AMD-Vi. When the operating system uses it, a DMA card reaches only memory the OS allows, so PCILeech cannot read the target's memory. That is the protection working as designed.

### JTAG port

JTAG (IEEE 1149.1) is a standard test and debug interface, used on FPGA boards to load and debug designs during development. Memory acquisition with PCILeech and MemProcFS goes through the USB data port and does not need it.

### Kernel DMA Protection

A Windows feature that uses the IOMMU to block DMA from hot-plug PCIe peripherals, such as Thunderbolt, USB4 and CFexpress devices, whose drivers do not support DMA remapping. It relies on the IOMMU being enabled in firmware. Check its status in System Information (`msinfo32`) on the "Kernel DMA Protection" line. Microsoft documents it on its [Kernel DMA Protection page](https://learn.microsoft.com/en-us/windows/security/hardware-security/kernel-dma-protection-for-thunderbolt).

### LeechCore

The device library under PCILeech and MemProcFS, by the same author. It opens the acquisition source (an FPGA card, a memory image file or another supported device) and handles reads, so both tools share options such as `-device fpga` and `-memmap`.

### Memory image

A file holding a copy of a computer's physical memory, roughly as large as its RAM. It can contain passwords, encryption keys and private data, so it needs encrypted storage, a SHA-256 hash and a chain-of-custody record. MemProcFS analyses saved images as well as live memory. See [MemProcFS live memory forensics](/guides/memprocfs-live-memory-forensics).

### Memory map (memmap)

A list of the physical address ranges that hold real RAM on a given computer. PCILeech and MemProcFS accept one with `-memmap <file>` and then read only those ranges. On AMD targets, a saved map prevents reads outside RAM that can stall DMA until the card is power-cycled. MemProcFS writes one to `M:\sys\memmap\physmemmap.txt`.

### MemProcFS

An open-source tool by Ulf Frisk that shows physical memory as a drive of files and folders: processes, modules, network connections, registry hives and forensic results. It works on live memory through a DMA card or on saved memory images, and has a Python API. On Windows it mounts through Dokany. See [MemProcFS live memory forensics](/guides/memprocfs-live-memory-forensics).

### PCIe generation and lanes

PCIe speed depends on generation (gen1 2.5 GT/s per lane, gen2 5 GT/s, gen3 8 GT/s) and lane count (x1, x4, x8 or x16). An x1 card works in any longer slot. PCILeech FPGA designs link at PCIe gen2 x1 even on boards with more lanes, and the USB link, not PCIe, sets read speed. See [DMA card compatibility](/guides/dma-card-compatibility).

### PCILeech

An open-source tool by Ulf Frisk for reading physical memory over PCIe DMA with no software on the target. It runs connection tests (`pcileech probe`), speed tests (`pcileech benchmark`) and full memory dumps. "PCILeech-compatible" describes hardware that presents the interface PCILeech expects; the project does not list or endorse TraceCore boards. See [PCILeech-compatible hardware](/guides/pcileech-compatible-hardware).

### Target system

The computer whose memory is examined. The DMA card sits in one of its PCIe slots, while PCILeech and MemProcFS run on the analysis workstation, so nothing is installed on the target. Use a DMA card only on computers you own or are authorized to examine. See [install a PCIe DMA card](/guides/install-a-pcie-dma-card).

### TLP (transaction layer packet)

The unit of communication on PCIe: memory reads, memory writes, completions and configuration accesses each travel as TLPs. FPGA-based DMA cards can send and receive raw TLPs, which makes them useful for PCIe protocol research and hardware debugging.

### USB 3 data link

The USB-C connection that carries data from a DMA card to the analysis workstation. The TraceCore 75T link works in USB 3.1 and USB 3.2 (Gen 1 and Gen 2) ports. A USB 2 port still enumerates the card but is far slower, and `pcileech benchmark` warns below 45 MB/s. Test it with the [connection and speed test](/guides/dma-card-connection-and-speed-test).

### VBS (virtualization-based security)

A Windows feature that uses the hypervisor to isolate parts of memory from the rest of the operating system; memory integrity (HVCI) runs on top of it. The PCILeech documentation says DMA acquisition does not work fully when VBS is in use. System Information (`msinfo32`) shows its state on the "Virtualization-based security" line.

## Video fusers and display signals

Terms for video fusers used for stream overlays, presentation overlays, picture-in-picture, capture and digital signage. Start with [what is a video fuser](/guides/what-is-a-video-fuser), or browse the [video fusers](/shop/fuser).

### Bandwidth (video data rate)

The data rate a video mode needs: pixel clock times bits per pixel. 8-bit RGB uses 24 bits per pixel, so 4K at 120 Hz needs about 25.8 Gbit/s, and 10-bit colour needs 1.25 times as much. Compare the result with an interface's usable data rate, not its headline figure. See [pixel clock and fuser bandwidth](/guides/pixel-clock-and-fuser-bandwidth).

### Chroma 4:4:4

A colour format in which every pixel carries its own colour information. Formats such as 4:2:2 and 4:2:0 share colour samples between neighbouring pixels to save bandwidth, which softens colour edges. For keying and small text, 4:4:4 (or RGB) keeps edges sharp, at the cost of more bandwidth.

### CVT-RB (reduced blanking)

VESA's Coordinated Video Timings with reduced blanking: a standard way to calculate display timings with short blanking intervals, which lowers the pixel clock for a given mode. Version 2 trims blanking further. Real monitors publish their own timings in EDID, so figures can differ slightly.

### DSC (Display Stream Compression)

VESA's visually lossless video compression, at up to 3:1. DisplayPort 1.4 added DSC 1.2, and HDMI 2.1 supports it too. It lets an interface carry modes beyond its raw data rate, such as 4K at 144 Hz over DisplayPort 1.4. Whether a video fuser accepts a DSC signal depends on the model, so check its listed modes.

### EDID

Extended Display Identification Data: a block of data a display sends to each source, listing the resolutions, refresh rates and timings it supports. Sources use it to choose an output mode. A video fuser passes the monitor's EDID through, or offers its own mode list, so both sources output a mode the monitor accepts. See [video fuser resolution and refresh](/guides/video-fuser-resolution-and-refresh).

### FRL (Fixed Rate Link)

The signalling HDMI 2.1 uses for its highest-bandwidth modes. It runs up to four lanes at up to 12 Gbit/s each, 48 Gbit/s in total, or about 42 Gbit/s of video data after encoding. Full rate needs an Ultra High Speed HDMI cable. See [DisplayPort and HDMI 2.1 video fuser setup](/guides/displayport-and-hdmi-2-1-fuser-setup).

### HBR3

High Bit Rate 3: the fastest DisplayPort 1.3 and 1.4 link rate, 8.1 Gbit/s per lane. Four lanes give 32.4 Gbit/s, or 25.92 Gbit/s of video data after 8b/10b encoding, enough for 4K at 120 Hz in 8-bit RGB without compression. Use a VESA-certified DisplayPort cable for HBR3 links.

### Keying

Combining two video sources by making one colour in the overlay source transparent so the program feed shows through, as in broadcast chroma or colour keying. On a video fuser, source 1 is usually the program feed and source 2 the graphics layer. A keying strength setting controls how close a colour must be to the key to drop out.

### Pixel clock

The number of pixels sent per second, including the blanking intervals around the visible image: total width times total height times refresh rate. For example, 1920x1080 at 240 Hz needs about 583 MHz with CVT-RB v2 timings. The pixel clock decides which interface can carry a mode; try the [pixel clock calculator](/tools/pixel-clock-calculator).

### RGB vs YCbCr

Two ways to encode colour. RGB sends red, green and blue values per pixel; YCbCr sends brightness plus two colour-difference values and allows chroma subsampling. Both sources and the display should agree on format and range (full or limited), or colours look washed out or crushed and the key colour can shift.

### TMDS

Transition-minimized differential signalling: the signalling used by HDMI 1.x and 2.0. HDMI 2.0 reaches 18 Gbit/s, about 14.4 Gbit/s of video data, at a TMDS character rate of up to 600 MHz. Modes beyond that need HDMI 2.1 FRL or DisplayPort. See [HDMI video fuser setup](/guides/hdmi-video-fuser-setup).

### Video fuser

A device that takes two video sources and combines them on one display by keying the second source over the first. Uses include stream overlays, presentation and teleprompter overlays, picture-in-picture, capture and digital signage. Models differ in interfaces (HDMI 2.0, HDMI 2.1, DisplayPort 1.4) and supported modes. See [choosing a video fuser](/guides/choosing-a-video-fuser).

## USB input passthrough

Terms for USB passthrough devices that sit between a mouse or keyboard and a computer. Setup guides: [MAKCU setup](/guides/makcu-setup) and [Ferrum USB passthrough setup](/guides/ferrum-setup); browse the [input devices](/shop/input).

### Added latency

The extra delay a passthrough device adds between a mouse or keyboard and the computer, usually listed as an average at a given polling rate. For example, the vendor-listed figures for Ferrum USB passthrough are 0.6 ms at 1000 Hz and 0.14 ms at 8000 Hz, not TraceCoreLab measurements.

### Full-speed and high-speed USB

Two USB 2.0 speed classes. Full speed runs at 12 Mbit/s and schedules transfers in 1 ms frames, so polling tops out at 1000 Hz. High speed runs at 480 Mbit/s with 125 microsecond microframes, which allows up to 8000 Hz. A passthrough device on a full-speed path caps polling at 1000 Hz, whatever the mouse supports.

### HID (Human Interface Device)

The USB device class for mice, keyboards and similar devices. A HID device sends small reports (button states, movement, key presses) that the operating system reads with its built-in driver, so a mouse or keyboard normally needs no extra driver. A passthrough device forwards these reports.

### Passthrough

Forwarding a USB device's data through another device to the computer. A USB passthrough device sits between a mouse or keyboard and the computer; with full device passthrough, the computer sees the original device, so its maker's software keeps working. The path's USB speed caps the polling rate. See [MAKCU vs Ferrum](/guides/makcu-vs-ferrum).

### Polling rate

How often the computer asks a USB device for new data, in hertz. 1000 Hz means once per millisecond; 8000 Hz means once every 125 microseconds. A higher rate shortens the wait between reports, but only when the mouse, the passthrough path and the port all support it. See [1000 Hz vs 8000 Hz polling](/guides/usb-polling-rate-1000hz-vs-8000hz).

