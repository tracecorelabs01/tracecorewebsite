---
title: "DMA Card Speed Test: Run pcileech probe and pcileech benchmark"
description: "Check a DMA card connection with pcileech probe -v, measure read speed with pcileech benchmark, read the results and fix a slow USB 2 link on the analysis PC."
section: "dma"
kind: "guide"
seo_title: "DMA Card Speed Test with pcileech probe and benchmark"
related_products: ["tracecore-75t", "tracecore-100t-pro", "usb-c-data-cable", "dma-mini-pc"]
sort_order: 4
reviewed_by: "TraceCoreLab team"
---

Two PCILeech commands verify a DMA card. `pcileech probe -v` confirms that the analysis PC can reach the card and that the target PC has enumerated it, and `pcileech benchmark` measures read speed over the USB 3 link. Both only read memory, and if the benchmark warns about USB 2 speed, the fix is usually the port, cable or hub rather than the card.

Use a DMA card only on computers you own or are authorized to examine.

## What you need

- The card installed in the target PC, enabled, with its data port connected. See [how to install a PCIe DMA card](/guides/install-a-pcie-dma-card).
- The FT601 driver, the FTDI DLL and PCILeech set up on the analysis PC. See the [FT601 driver and PCILeech setup guide](/guides/ft601-driver-and-pcileech-setup).
- The target PC powered on and started up.
- A terminal open in the PCILeech folder on the analysis PC: Command Prompt or PowerShell on Windows (for example `cd C:\pcileech`), or a root shell on Linux.

## Step 1: Connection check

Run:

```
pcileech probe -v
```

Without a `-device` option, PCILeech looks for FPGA hardware first. With `-v`, LeechCore prints one line that describes the card and its link. On success it has this format:

```
DEVICE: FPGA: <device name> PCIe gen2 x1 [<read>,<write>,<probe> delays] [v<major>.<minor>,<device id>] [ASYNC|SYNC,NORM|TINY]
```

| Part of the line | What it tells you |
|---|---|
| `DEVICE: FPGA:` | PCILeech found an FPGA board on the USB link |
| `<device name>` | The board type the FPGA design reports |
| `PCIe gen2 x1` | The PCIe link to the target PC. Artix-7 boards normally report gen2 x1, and x1 is expected even in a x16 slot |
| `[<read>,<write>,<probe>]` | Timing delays the design uses |
| `[v<major>.<minor>,<device id>]` | The FPGA design version and the card's PCIe device ID on the target |
| `ASYNC` or `SYNC`, `NORM` or `TINY` | How data moves over the USB link |

After that line, `probe` lists the ranges of physical memory it can read on the target. To limit the scan, give a maximum address, for example `pcileech probe -max 0x280000000`.

### What the result means

| You see | Meaning | Next step |
|---|---|---|
| The `DEVICE: FPGA:` line, then memory ranges | The USB side and the PCIe side both work | Run the benchmark |
| `Unable to connect to FPGA device` | USB side: driver, DLL, port, cable or power | See the [troubleshooting guide](/guides/dma-card-troubleshooting) |
| `Unable to retrieve required Device PCIe ID` | USB works, but the target PC has not enumerated the card | See the [troubleshooting guide](/guides/dma-card-troubleshooting) |

## Step 2: Benchmark

Run:

```
pcileech benchmark
```

The benchmark reads physical address 0x1000 on the target in seven block sizes: 8 B, 128 B, 512 B, 4 KB, 64 KB, 1 MB and 16 MB. It spends 5 seconds on each size, so a run takes about 35 seconds, and prints reads per second and MB/s for each. The help text calls it a read and write benchmark, but the current code only reads. The command arrived in PCILeech 4.18, so update first if your build does not know it.

### How to read the numbers

- Small blocks show many reads per second but low MB/s, because each request has a fixed overhead.
- The 16 MB row is the throughput figure to compare between ports, cables and PCs.
- If the 16 MB row reads below 45 MB/s, PCILeech prints a warning like this:

```
WARNING! Read speed is slow. USB connection most likely at USB2 speed. Check port/cable/connection
```

## What results to expect

TraceCoreLab tests every unit in our lab before dispatch. The [TraceCore 75T](/product/tracecore-75t) product page lists throughput of up to 200 MB/s over its USB 3 link, which uses a 5 Gbit/s FT601 bridge. Your own figure depends on the analysis PC's USB controller, the operating system, the cable and the target platform, so treat any single number as a guide rather than a promise.

## Published figures for other boards

The open-source pcileech-fpga project lists these speeds for other Artix-7 boards. They are published figures for other boards, not TraceCoreLab measurements. The source is the [pcileech-fpga README](https://github.com/ufrisk/pcileech-fpga).

| Board | FPGA | Link | Published speed |
|---|---|---|---|
| CaptainDMA 75T | XC7A75T | PCIe gen2 x1, USB-C | 200 MB/s |
| CaptainDMA 100T | XC7A100T | PCIe gen2 x1, USB-C | 220 MB/s |
| Enigma X1 | 75T | USB-C | 200 MB/s |
| 35T boards | 35T | USB-C | 190 MB/s |

The PCILeech README also quotes about 90 MB/s on Linux against about 150 MB/s on Windows for FPGA boards (again published figures for other boards, not TraceCoreLab measurements), so expect lower numbers on a Linux analysis PC.

## Why speed is low

| Cause | Fix |
|---|---|
| USB 2 port, front-panel port, hub or dock | Move the cable to a rear USB 3 port on the motherboard |
| Cable that is not USB 3, or a damaged one | Use the cable from the box or the [USB-C 3.2 Data Cable](/product/usb-c-data-cable) |
| Linux analysis PC | Lower numbers are expected; compare against other Linux runs only |
| Other busy devices on the same USB controller | Unplug them for the test, or use a port on another controller |

### Optional: confirm the USB link speed

On Windows, [UsbTreeView](https://www.uwe-sieber.de/usbtreeview_e.html) from its author's official page shows the speed each USB device negotiated. A card on a SuperSpeed link shows "3.2 Gen 1 (aka USB 3.0 - 5 Gbit/s)". A lower speed there confirms a port, hub or cable problem.

> [!TIP]
> If the benchmark shows the USB 2 warning, try a different rear port before changing anything else. It is the quickest fix.

## Optional read-only test

To check reads at one address without the full benchmark:

```
pcileech testmemread -min 0x1000
```

To show the contents of a single page:

```
pcileech display -min 0x1000
```

> [!WARNING]
> Skip `pcileech testmemreadwrite`. It writes to the target PC's memory and then restores it. Read-only tests are enough to verify a card.

## Save the output for support

If you contact [support](/support), send:

1. The full console output of `pcileech probe -v` and `pcileech benchmark`.
2. Your PCILeech version and the analysis PC's operating system.
3. Which USB port and cable you used.

On Windows you can save the output to a file, for example `pcileech benchmark > benchmark.txt`, or copy the text straight from the terminal. If something failed, the [DMA card troubleshooting guide](/guides/dma-card-troubleshooting) covers each error, and [choosing an analysis PC](/guides/choosing-an-analysis-pc) explains what to look for in the second machine.

## FAQ

### What is a good DMA card speed test result?

Above 45 MB/s on the 16 MB row means the link is running at USB 3 speed. The 75T product page lists up to 200 MB/s, and your result depends on the analysis PC, cable and operating system.

### Why does pcileech benchmark say my USB connection is at USB2 speed?

Reads on 16 MB blocks fell below 45 MB/s. Move the cable to a rear USB 3 port, remove any hub or dock and try another USB 3 cable.

### Does pcileech benchmark write to the target PC's memory?

No. The help text mentions writes, but the current code only reads at physical address 0x1000.

### Does a x16 slot make a DMA card faster?

No. PCILeech FPGA designs link at PCIe x1 whichever slot the card sits in, so the slot size does not change the result.

### Why is the speed lower on Linux?

The PCILeech README quotes lower FPGA throughput on Linux than on Windows. Compare Linux results only with other Linux runs.
