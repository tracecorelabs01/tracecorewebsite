---
title: "DMA Card Troubleshooting: LEDs, Not Detected, Slow or Failed Reads"
description: "Fix a DMA card that is not detected, slow or failing reads: LED states, Unable to connect to FPGA device, the PCIe ID error, USB 2 speed and AMD memory maps."
section: "dma"
kind: "guide"
seo_title: "DMA Card Troubleshooting: Fix Connection and Read Errors"
related_products: ["tracecore-75t", "tracecore-100t-pro", "thermal-kit", "usb-c-data-cable"]
sort_order: 5
reviewed_by: "TraceCoreLab team"
---

Most DMA card problems fall on one of two sides. On the USB side, the analysis PC cannot reach the card, and PCILeech says `Unable to connect to FPGA device`. On the PCIe side, the card answers over USB but the target PC has not enumerated it, or the target's own protections stop memory reads. Start with the quick diagnosis table, then jump to the matching section.

Use a DMA card only on computers you own or are authorized to examine.

## What you need

- The console output of `pcileech probe -v`, run from the PCILeech folder on the analysis PC. See the [connection and speed test guide](/guides/dma-card-connection-and-speed-test).
- Access to both machines: the target PC (with the card) and the analysis PC (running PCILeech).
- Device Manager on a Windows analysis PC, or a root shell on Linux.

## Quick diagnosis table

| Symptom | Likely cause | Go to |
|---|---|---|
| No LEDs on the card | No power from the slot | [LED states](#led-states) |
| `Unable to connect to FPGA device` | USB side: driver, DLL, port, cable or power | [Unable to connect](#unable-to-connect-to-fpga-device) |
| `Unable to configure FT601 pipe timeouts` | FT601 driver problem | [Unable to connect](#unable-to-connect-to-fpga-device) |
| `Unable to retrieve required Device PCIe ID` | The target PC has not enumerated the card | [PCIe ID error](#unable-to-retrieve-required-device-pcie-id) |
| USB 2 warning in the benchmark, or low MB/s | The link is running at USB 2 speed | [Slow speed](#slow-speed-and-the-usb-2-warning) |
| Reads return only zeros | Enable switch, link, or a platform protection | [Reads return zeros](#reads-return-zeros) |
| Card connects, but memory analysis fails | The target's IOMMU or VBS limits reads | [Memory analysis fails](#memory-analysis-fails-vmm-init-failed) |
| AMD target: reads stop until the card is power-cycled | Out-of-range reads while memory ranges are probed | [AMD memory maps](#amd-systems-memory-maps) |
| Permission errors on Linux | USB access needs root | [Linux](#linux-permission-errors) |
| Card works when cold, then drops out | Heat in a cramped case | [Overheating](#overheating) |

## LED states

LED colours, count and positions differ between boards, so this table describes states rather than colours. If you need the meaning of a specific LED on your card, ask us through [support](/support).

| What you see | What it usually means | What to check |
|---|---|---|
| No LED lit, target PC on | The card is not getting power from the slot | The target PC is fully on (not asleep), the card is seated all the way, then try another slot |
| LEDs lit, PCILeech cannot connect | The card has power; the problem is on the USB side | Data port, cable, driver and DLL |
| LEDs lit, PCILeech connects but reports the PCIe ID error | USB works; the target PC has not enumerated the card | Enable switch, seating, a full shutdown and restart of the target |
| LED state changes when you move the enable switch | The switch is working | Leave it at enabled while testing |
| LEDs go dark during a session | The card lost power or was disabled | Enable switch position, the target PC's power state, cable strain on the card |

## Unable to connect to FPGA device

PCILeech prints `DEVICE: FPGA: ERROR: Unable to connect to FPGA device` when it cannot talk to the card over USB, or cannot read the FPGA version. Work through these in order:

1. **Target PC on.** The card needs the target PC powered on.
2. **Device Manager.** On Windows, the card should show as **FTDI FT601 USB 3.0 Bridge Device**. If you see **FTDI SuperSpeed-FIFO Bridge** under Other devices, the driver is missing: follow the [FT601 driver and PCILeech setup guide](/guides/ft601-driver-and-pcileech-setup).
3. **FTDI DLL.** The 64-bit `FTD3XXWU.dll` or `FTD3XX.dll` must sit in the same folder as `pcileech.exe` and `leechcore.dll`.
4. **Data port.** If the card has two USB-C ports, the cable must be in the data port, not the JTAG programming port.
5. **Port and cable.** Try another rear USB 3 port and another USB 3 cable, such as the [USB-C 3.2 Data Cable](/product/usb-c-data-cable).

If you see `Unable to configure FT601 pipe timeouts`, the FT601 driver is at fault. Uninstall the device in Device Manager, reinstall FTDI's D3XX driver and replug the cable.

## Unable to retrieve required Device PCIe ID

This message means the USB side works but the card has no PCIe device ID. Our reading of the LeechCore code is that the target PC has not enumerated the card on its PCIe bus.

1. Check the enable switch on the card's I/O panel is at enabled.
2. Shut the target PC down fully, switch off its power supply for a few seconds, then power it on again. A restart alone may not be enough.
3. Reseat the card and check the bracket screw holds it firmly.
4. Try another PCIe slot. Some slots switch off when a nearby M.2 socket holds a drive; the [compatibility guide](/guides/dma-card-compatibility) explains this.

> [!NOTE]
> LeechCore has a diagnostic option, `-device fpga://pcienotconnected=1`, that skips the PCIe ID check so you can test the USB side on its own. Use it for diagnosis only; the card still cannot read memory without a PCIe link.

## Slow speed and the USB 2 warning

If `pcileech benchmark` reads below 45 MB/s on 16 MB blocks, it warns that the USB connection is most likely at USB 2 speed. A USB 2 link still works, just far more slowly.

1. Move the cable to a rear USB 3 port on the motherboard.
2. Remove any hub, dock, extension cable or front-panel port from the path.
3. Swap to a known USB 3 cable.
4. On Windows, confirm the negotiated speed as shown in the [speed test guide](/guides/dma-card-connection-and-speed-test).

The PCILeech README quotes lower FPGA throughput on Linux than on Windows, so compare Linux results only with other Linux runs.

## Reads return zeros

If reads come back as all zeros, check the hardware path first:

1. The enable switch is at enabled.
2. The cable is in the data port.
3. `pcileech probe -v` prints the `DEVICE: FPGA:` line with a PCIe link.

If all three are fine, zeros usually mean the target's IOMMU is blocking the card's memory reads. That is a platform protection doing its job, not a fault in the card. The [DMA card compatibility guide](/guides/dma-card-compatibility) explains IOMMU, VBS and Kernel DMA Protection and how a machine's owner checks their status.

## Memory analysis fails (vmm init failed)

Sometimes the device line appears and the benchmark runs, yet MemProcFS or a PCILeech analysis command stops with a VMM initialization error. The card is working; the analysis layer cannot build a view of the operating system's memory.

Two causes are common:

- **Platform protections.** The PCILeech README states that PCILeech does not work if the operating system uses the IOMMU/VT-d, and that Windows 10/11 with virtualization-based security (VBS) does not work fully. On a machine that runs these protections, the card cannot reach every page.
- **An AMD target without a memory map.** See the next section.

If protections are the cause, the machine is behaving as designed. Do not change its security settings to make an examination work. Under the same authorization, use another acquisition method, as described in the [compatibility guide](/guides/dma-card-compatibility). For MemProcFS basics, see [live memory forensics with MemProcFS](/guides/memprocfs-live-memory-forensics).

## AMD systems: memory maps

On some AMD targets, a read outside the real memory ranges, while PCILeech probes for them, stops DMA until the card is power-cycled. The fix is to give PCILeech or MemProcFS a memory map, so it reads only valid ranges.

1. Build the map on the target PC with Microsoft Sysinternals [RAMMap](https://learn.microsoft.com/en-us/sysinternals/downloads/rammap) (the Physical Ranges tab), or copy `M:\sys\memmap\physmemmap.txt` from an earlier MemProcFS session.
2. Save it as `physmemmap.txt` on the analysis PC.
3. Pass it with every command:

```
pcileech probe -v -memmap physmemmap.txt
memprocfs.exe -device fpga -memmap physmemmap.txt
```

The memory map usually stays the same across reboots, so you can reuse it. `-memmap auto` exists, but treat it as a last resort. The [LeechCore AMD notes](https://github.com/ufrisk/LeechCore/wiki/Device_FPGA_AMD_Thunderbolt) have the details.

## Linux permission errors

On Linux, PCILeech needs direct USB access:

1. Install libusb (`sudo apt-get install libusb-1.0-0` on Debian and Ubuntu).
2. Keep `leechcore_ft601_driver_linux.so` in the same folder as the `pcileech` binary.
3. Run PCILeech as root, for example `sudo ./pcileech probe -v`.

## Overheating

FPGA boards get warm under long, sustained workloads, and a cramped case with little airflow makes it worse. A card that works when cold and drops out after a long session points to heat.

1. Move the card to a slot with more space around it, away from the graphics card's exhaust.
2. Improve case airflow around the expansion slots.
3. On the 75T, fit the [Thermal Kit](/product/thermal-kit), a clip-on aluminium heatsink with pre-cut thermal pads. See [how to install the Thermal Kit](/guides/install-dma-card-thermal-kit).

The 100T Pro already carries its own aluminium heatsink.

## Before a warranty claim

Every TraceCore card has a 3-month warranty; the terms are on the [warranty page](/legal/warranty). Before you open a claim, collect:

1. The full output of `pcileech probe -v` and `pcileech benchmark`.
2. Your PCILeech version and the analysis PC's operating system.
3. The steps from this guide you have already tried.
4. A photo of the card in the slot, with the bracket and cable visible.
5. Your order number.

Then contact us through [support](/support). Clear output and photos let us answer faster.

## FAQ

### Why is my DMA card not detected?

Check the USB side first: the target PC is on, the cable is in the data port, Device Manager shows FTDI FT601 USB 3.0 Bridge Device and the FTDI DLL sits next to `pcileech.exe`.

### What does "Unable to connect to FPGA device" mean?

PCILeech cannot talk to the card over USB. The usual causes are a missing driver or DLL, the wrong port, a bad cable or a target PC that is switched off.

### What does "Unable to retrieve required Device PCIe ID" mean?

USB works, but the target PC has not enumerated the card. Check the enable switch, reseat the card and do a full power-off and power-on of the target.

### Why does my DMA card show a red light?

LED colours differ between boards, so a red LED does not mean the same thing on every card. Use the state table above, and ask us through support for the meaning on your board.

### Why do reads return zeros?

Check the enable switch and the data port first. If the card links and reads still return zeros, the target's IOMMU is probably blocking them, which is a platform protection working as designed.
