---
title: "FT601 Driver and PCILeech Setup on the Analysis PC (Windows, Linux)"
description: "Install the FT601 driver, check Device Manager, place the FTDI D3XX DLL and set up PCILeech and MemProcFS on a Windows or Linux analysis PC for a DMA card."
section: "dma"
kind: "guide"
seo_title: "FT601 Driver Install and PCILeech Setup for FPGA DMA Cards"
related_products: ["tracecore-75t", "tracecore-100t-pro", "dma-mini-pc"]
sort_order: 3
reviewed_by: "TraceCoreLab team"
---

The analysis PC talks to a DMA card through an FTDI FT601 USB 3 bridge, so it needs the FT601 driver (Windows usually installs it on its own) and FTDI's D3XX DLL placed next to PCILeech. PCILeech and MemProcFS then come straight from their official GitHub release pages. Nothing is installed on the target PC.

Use a DMA card only on computers you own or are authorized to examine.

> [!NOTE]
> This guide is for boards with an FT601 bridge, such as the [TraceCore 75T](/product/tracecore-75t), whose specifications list a USB 3 link through an FT601 USB-to-FIFO bridge. If Device Manager shows a different device name for your card, contact [support](/support) before installing anything else.

## What you need

- **The card, installed and enabled** in the target PC, with its data port connected by USB-C and the target PC powered on. If you have not done this yet, follow [how to install a PCIe DMA card](/guides/install-a-pcie-dma-card).
- **An analysis PC** running 64-bit Windows or Linux, with a USB 3 port. The [DMA Mini PC](/product/dma-mini-pc) is a compact dedicated option with three USB 3.2 ports.
- **Administrator rights** on Windows, or root on Linux.
- **Internet access** for Windows Update and the downloads below.

## How the pieces fit

| Piece | Where it goes | What it does |
|---|---|---|
| FT601 kernel driver | Windows, installed system-wide | Lets Windows talk to the card's USB 3 bridge |
| FTDI D3XX DLL | The PCILeech folder (and the MemProcFS folder) | The user-mode library LeechCore uses to reach the driver |
| PCILeech | Any folder on the analysis PC | Command-line tool for probe, benchmark and memory reads |
| LeechCore | Ships inside PCILeech and MemProcFS | The library that talks to the card |
| MemProcFS | Any folder on the analysis PC | Shows target memory as files for forensic analysis |
| Dokany v2 | Windows, installed system-wide | Needed only for the mount features |

## Windows

### Kernel driver

1. Power on the target PC with the card enabled and the cable connected to the analysis PC.
2. Wait a minute. On first connection, Windows normally installs the FT601 driver from Windows Update.
3. If Windows does not install it, download FTDI's D3XX driver package (WHQL certified) from the [FTDI D3XX drivers page](https://ftdichip.com/drivers/d3xx-drivers/) and install it.

### Check Device Manager

Open Device Manager (right-click Start, then Device Manager) and look for the card.

| Device Manager shows | Listed under | Meaning | What to do |
|---|---|---|---|
| FTDI FT601 USB 3.0 Bridge Device | Universal Serial Bus devices | Driver installed | Go to the next step |
| FTDI SuperSpeed-FIFO Bridge, with a warning icon | Other devices | Driver missing | Follow the steps below |
| No new device at all | Nothing | The card is not powered or not connected | Check the target PC is on, the enable switch, the data port and the cable |

If the driver is missing:

1. Right-click **FTDI SuperSpeed-FIFO Bridge** and choose **Uninstall device**.
2. Install FTDI's D3XX driver package from the official FTDI page.
3. Unplug the USB-C cable from the analysis PC, wait a few seconds and plug it back in.
4. Confirm the card now shows as **FTDI FT601 USB 3.0 Bridge Device**.

### Download PCILeech and MemProcFS

1. Download the latest PCILeech release from the [PCILeech releases page](https://github.com/ufrisk/pcileech/releases) and extract it to a folder with a short path, such as `C:\pcileech`.
2. If you plan to analyse memory, also download MemProcFS from the [MemProcFS releases page](https://github.com/ufrisk/MemProcFS/releases). The [MemProcFS live memory forensics guide](/guides/memprocfs-live-memory-forensics) covers how to use it.

> [!WARNING]
> Download PCILeech, MemProcFS and the FTDI files only from the official GitHub and FTDI pages linked here. Do not use repackaged bundles or "all in one" archives shared on forums or chat servers.

### Place the FTDI DLL

PCILeech needs FTDI's user-mode D3XX DLL in the same folder as `pcileech.exe` and `leechcore.dll`.

1. From the [FTDI D3XX drivers page](https://ftdichip.com/drivers/d3xx-drivers/), download the D3XX package for 64-bit Windows (x64).
2. Copy the 64-bit DLL into your PCILeech folder. Current LeechCore versions load `FTD3XXWU.dll` (the DLL for FTDI driver 1.4) first and fall back to `FTD3XX.dll`.
3. If you use MemProcFS, copy the DLL into the MemProcFS folder too. MemProcFS asks for `FTD3XXWU.dll`.

> [!TIP]
> A missing DLL, a 32-bit DLL or a DLL in the wrong folder all end the same way: PCILeech reports `Unable to connect to FPGA device`. Check the DLL first when that message appears.

### Install Dokany v2

Dokany is only needed for the mount features: `pcileech mount` and the MemProcFS drive letter. Install the v2 release from the [Dokany releases page](https://github.com/dokan-dev/dokany/releases/latest) and restart if the installer asks. You can skip it if you only plan to run probe and benchmark tests.

## Linux

1. Install libusb. On Debian and Ubuntu:

   ```
   sudo apt-get install libusb-1.0-0
   ```

   Other distributions have the same library under a similar name in their package manager.
2. Download the Linux build of PCILeech from the same [PCILeech releases page](https://github.com/ufrisk/pcileech/releases) and extract it. The FT601 plugin, `leechcore_ft601_driver_linux.so`, ships with the release. Keep it in the same folder as the `pcileech` binary.
3. Run PCILeech as root, because it needs direct USB access:

   ```
   sudo ./pcileech probe -v
   ```

4. Know the limits. `pcileech mount` is Windows-only. FPGA throughput is also lower on Linux: the PCILeech README quotes about 90 MB/s on Linux against about 150 MB/s on Windows. Those are published figures for other boards, not TraceCoreLab measurements.

## Versions and updates

- Use the latest releases of PCILeech, MemProcFS and the FTDI D3XX driver. LeechCore, the library that talks to the card, ships inside the PCILeech and MemProcFS releases.
- Write down the version numbers you install. The release pages list them, and support will ask for them.
- When you update PCILeech, check that the FTDI DLL is still in the new folder.
- You do not need any JTAG programmer drivers to use PCILeech. Leave them out.

## Common setup mistakes

| Mistake | What you see | Fix |
|---|---|---|
| FTDI DLL missing or in another folder | `Unable to connect to FPGA device` | Copy the 64-bit DLL next to `pcileech.exe` and `leechcore.dll` |
| 32-bit DLL copied by mistake | `Unable to connect to FPGA device` | Use the x64 DLL from the D3XX package |
| FT601 driver not installed | FTDI SuperSpeed-FIFO Bridge under Other devices | Install FTDI's D3XX driver and replug |
| Target PC switched off | No new USB device on the analysis PC | Power on the target PC first |
| Cable in the JTAG port | The FT601 device never appears | Move the cable to the data port |
| Linux run without root | Permission or USB access errors | Run PCILeech with `sudo` |
| Front-panel port or hub | USB 2 warning in the benchmark | Use a rear USB 3 port |

## Next: connection and speed test

The analysis PC is ready. Run `pcileech probe -v` and `pcileech benchmark` as described in the [DMA card connection and speed test guide](/guides/dma-card-connection-and-speed-test). If an error appears, the [DMA card troubleshooting guide](/guides/dma-card-troubleshooting) lists each message with its fix.

## FAQ

### Where do I download the FT601 driver?

Windows usually installs it from Windows Update the first time the card connects. If it does not, use the D3XX driver package on FTDI's official D3XX drivers page.

### Why does Device Manager show FTDI SuperSpeed-FIFO Bridge?

The FT601 driver is missing. Uninstall that device, install FTDI's D3XX driver package and replug the cable. The card should then show as FTDI FT601 USB 3.0 Bridge Device.

### Where does FTD3XX.dll go?

In the same folder as `pcileech.exe` and `leechcore.dll`, and in the MemProcFS folder if you use it. It must be the 64-bit DLL.

### Do I install anything on the target PC?

No. The DMA card reads memory over PCIe without any driver on the target PC. All drivers and software go on the analysis PC.

### Does PCILeech work on Linux?

Yes. Install libusb, keep the bundled FT601 plugin next to the binary and run as root. Throughput is lower than on Windows, and the mount feature is Windows-only.
