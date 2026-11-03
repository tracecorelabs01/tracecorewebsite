---
title: "MemProcFS with an FPGA DMA Card: Live Memory Forensics Basics"
description: "Mount live memory with MemProcFS and a PCILeech-compatible FPGA DMA card, run forensic mode and YARA, then acquire and hash a full image for chain of custody."
section: "dma"
kind: "guide"
seo_title: "MemProcFS FPGA Guide: Live Memory Forensics with a DMA Card"
related_products: ["tracecore-75t", "tracecore-100t-pro", "dma-mini-pc"]
sort_order: 7
reviewed_by: "TraceCoreLab team"
---

MemProcFS turns physical memory into a drive of ordinary files and folders, so you can examine a live Windows system with Explorer, a text editor or Python. With a PCILeech-compatible FPGA DMA card in the target system and MemProcFS on your analysis workstation, `memprocfs.exe -device fpga` mounts the target's memory as drive M:. This guide covers mounting, forensic mode, YARA scans, acquiring a full image, and the chain-of-custody records that keep that image usable as evidence.

> [!WARNING]
> Use a DMA card only on computers you own or are authorized to examine. Get the authorization in writing and record it in your case notes.

## What MemProcFS does

MemProcFS is an open-source memory analysis tool by Ulf Frisk, the author of PCILeech. It reads memory through LeechCore, the device library PCILeech also uses, and presents it as a virtual file system:

- processes by name and PID, each with its loaded modules, handles and threads
- system-wide views: the process tree, network connections and services
- registry hives, as keys or as hive files
- forensic results (timelines, an NTFS file listing rebuilt from memory, YARA matches) when forensic mode is on

It works on saved memory images and on live memory. For live memory, a PCIe DMA card in the target reads physical memory over PCIe and streams it over its USB 3 data link to the analysis workstation, so nothing is installed on the target. The [TraceCore 75T](/product/tracecore-75t) and [TraceCore 100T Pro](/product/tracecore-100t-pro) are PCILeech-compatible FPGA boards; [PCILeech-compatible hardware](/guides/pcileech-compatible-hardware) explains what that term covers.

![TraceCore 75T FPGA DMA card for live memory acquisition with PCILeech and MemProcFS](/media/products/2026/11/c1b05e21801b9fa1f87d.webp)

## What you need

| Item | Notes |
|---|---|
| PCILeech-compatible FPGA DMA card | In a PCIe slot of the target; see [install a PCIe DMA card](/guides/install-a-pcie-dma-card) |
| USB-C data cable | Card data port to a native USB 3 port on the workstation |
| Analysis workstation | 64-bit Windows recommended; see [choosing an analysis PC](/guides/choosing-an-analysis-pc) |
| FT601 driver and `FTD3XXWU.dll` | See [FT601 driver and PCILeech setup](/guides/ft601-driver-and-pcileech-setup) |
| MemProcFS | Latest release from the [MemProcFS GitHub page](https://github.com/ufrisk/MemProcFS) |
| Dokany v2 | Mounts M: on Windows ([Dokany releases](https://github.com/dokan-dev/dokany/releases/latest)) |
| Evidence drive | Encrypted, with more free space than the target has RAM |

First confirm the card connects at USB 3 speed with the [connection and speed test](/guides/dma-card-connection-and-speed-test). A link that falls back to USB 2 still works but is far slower, and `pcileech benchmark` warns when reads drop under 45 MB/s.

## Mount live memory

1. Extract the MemProcFS release to a folder such as `C:\Tools\MemProcFS`.
2. Copy the 64-bit `FTD3XXWU.dll` from FTDI's [D3XX driver package](https://ftdichip.com/drivers/d3xx-drivers/) next to `memprocfs.exe`.
3. Install Dokany v2 and restart if asked.
4. Check that the card's enable switch on its I/O panel is on, then connect the data cable.
5. Open a Command Prompt in the MemProcFS folder and run:

   ```
   memprocfs.exe -device fpga
   ```

6. Drive M: stays mounted while the window is open; press Ctrl+C there to unmount.

The README example for live FPGA use adds `-memmap auto`, which builds the memory map from the target at start-up.

### AMD targets: use a saved memory map

On AMD systems, a read outside real RAM can stall DMA until the card is power-cycled, which on a live target ends the session. The [LeechCore notes for AMD systems](https://github.com/ufrisk/LeechCore/wiki/Device_FPGA_AMD_Thunderbolt) recommend a saved map:

```
memprocfs.exe -device fpga -memmap C:\Cases\case042\physmemmap.txt
```

Build it from the "Physical Ranges" view of Sysinternals [RAMMap](https://learn.microsoft.com/en-us/sysinternals/downloads/rammap) on a machine you administer, or copy `M:\sys\memmap\physmemmap.txt` from an earlier session on the same machine. The map usually survives reboots. Treat `-memmap auto` as a last resort on AMD.

## Explore the file system

| Path | What it holds |
|---|---|
| `M:\name\`, `M:\pid\` | One folder per process, by name or PID |
| `M:\sys\` | Process tree, network, services, memory map |
| `M:\registry\` | Registry keys and raw hive files |
| `M:\forensic\` | Forensic mode output |
| `M:\memory.pmem` | Physical memory as one raw file |

Good starting points for triage:

- `M:\sys\proc\proc.txt`: the process tree. Look for unexpected parents and programs running from unusual paths.
- `M:\sys\net\netstat.txt`: connections and listening ports with the owning process.
- `M:\pid\<pid>\modules\`: the DLLs a process has loaded, with paths.
- `M:\registry\hive_files\`: hives for your usual registry tools.

The folders work with PowerShell, so outputs copy straight into the case folder. Live memory keeps changing, so note the time of every copy.

> [!NOTE]
> Paths match current MemProcFS releases. If one differs in your version, check the [MemProcFS wiki](https://github.com/ufrisk/MemProcFS/wiki).

## Forensic mode and YARA

Forensic mode makes a full pass over memory and writes results under `M:\forensic\`:

```
memprocfs.exe -device fpga -forensic 1
```

Value 1 keeps the working database in memory; higher values store it as a file, which helps on large targets. Results include a timeline, CSV and JSON exports, an NTFS listing rebuilt from memory, and FindEvil, which flags memory anomalies associated with malware on Windows 10 and later.

To scan with your own YARA rules, add the rules file. Matches appear under `M:\forensic\yara\`, and the [YARA documentation](https://virustotal.github.io/yara/) covers rule syntax:

```
memprocfs.exe -device fpga -forensic 1 -forensic-yara-rules C:\Cases\rules\incident.yar
```

> [!TIP]
> On live memory the forensic pass runs while the system keeps changing. For repeatable results, acquire a full image first and run forensic mode on the image.

## Python API: forensic artifacts

The Python package (`pip install memprocfs`, 64-bit Python) exposes the same artifacts. This example opens a saved image (pass `'fpga'` instead of the file name for live memory) and lists processes with their modules, network connections and registry hives:

```python
import memprocfs

vmm = memprocfs.Vmm(['-device', r'E:\case042\target-ram.raw'])

for process in vmm.process_list():
    print(process.pid, process.name)
    for module in process.module_list():
        print('    ', module.name)

for connection in vmm.maps.net():
    print(connection)

for hive in vmm.reg_hive_list():
    print(hive)

vmm.close()
```

Save the output in the case folder. The [Python API reference](https://github.com/ufrisk/MemProcFS/wiki/API_Python) lists the other artifact functions.

## Acquire a full memory image

For case work, acquire once and analyse a copy. Either copy `M:\memory.pmem` to the evidence drive while MemProcFS is mounted, or dump with PCILeech (add `-memmap <file>` on AMD targets):

```
pcileech.exe dump -out E:\case042\target-ram.raw
```

The image is roughly the size of the target's RAM. Hash it as soon as it is written and record the value:

```
Get-FileHash -Algorithm SHA256 E:\case042\target-ram.raw
```

Then analyse it offline with `memprocfs.exe -device E:\case042\target-ram.raw -forensic 1`. Live memory never repeats, so you cannot acquire it again to compare; the hash proves the file has not changed since acquisition.

## Fix "vmm init failed"

MemProcFS stops at start-up when it cannot open the device or make sense of the memory it reads.

| What you see | What to check |
|---|---|
| `DEVICE: FPGA: ERROR: Unable to connect to FPGA device` | Cable in the data port, FT601 driver in Device Manager, `FTD3XXWU.dll` next to `memprocfs.exe` |
| `Unable to configure FT601 pipe timeouts` | Reinstall the FTDI D3XX driver |
| Every read returns zeros | Enable switch on, card fully seated, target powered |
| Memory reads, but analysis fails | Platform protections (next section) |
| AMD target stalls after a few reads | Start with `-memmap` and a saved map |
| M: never appears | Install Dokany v2 |

### When platform protections block DMA

The PCILeech documentation says DMA acquisition does not work when the operating system uses the IOMMU (Intel VT-d, AMD-Vi), and does not work fully with virtualization-based security (VBS). That is the protection working as designed. System Information (`msinfo32`) shows "Kernel DMA Protection" and "Virtualization-based security" lines, and Microsoft's [Kernel DMA Protection page](https://learn.microsoft.com/en-us/windows/security/hardware-security/kernel-dma-protection-for-thunderbolt) explains what they cover. On a case system, record the protection state and choose an acquisition method that suits it, because changing firmware or security settings alters the system you are examining. See [DMA card troubleshooting](/guides/dma-card-troubleshooting) for more.

## Handle memory images securely

A memory image holds whatever was in RAM: passwords, encryption keys, session tokens and private documents. Store it on an encrypted volume with access limited to the case team, keep the original read-only, and delete it under your retention policy when the case closes. Collect memory before disk, following the order of volatility in [RFC 3227](https://www.rfc-editor.org/rfc/rfc3227).

Keep a chain-of-custody record for every image:

| Record | Example |
|---|---|
| Authorization | Written approval reference and who gave it |
| Target | Hostname, make, model, asset tag |
| Acquisition | Start and end time (UTC), examiner |
| Tools | PCILeech, MemProcFS and LeechCore versions, card model |
| Output | File name, size, SHA-256 hash, storage location |
| Transfers | Every copy or hand-over, with date, time and person |

## Quick reference

| Task | Command |
|---|---|
| Mount live memory | `memprocfs.exe -device fpga` |
| Mount with a memory map | `memprocfs.exe -device fpga -memmap physmemmap.txt` |
| Forensic mode with YARA | `memprocfs.exe -device fpga -forensic 1 -forensic-yara-rules rules.yar` |
| Full image | `pcileech.exe dump -out target-ram.raw` |
| Analyse a saved image | `memprocfs.exe -device target-ram.raw -forensic 1` |

## FAQ

### Does MemProcFS need software on the target computer?

No. MemProcFS runs on the analysis workstation, and the FPGA DMA card reads memory over PCIe without any driver on the target.

### Can MemProcFS analyse a saved memory image?

Yes. Pass the image file to `-device` instead of `fpga`. For case work this is the better approach: acquire once, hash, then analyse a copy.

### How large is a full memory image?

Roughly the size of the target's RAM. Plan for twice that on the evidence drive so you can keep the original and a working copy.

### Why does MemProcFS read only zeros?

The card is off or not linked to the target. Check the enable switch on the I/O panel, that the cable is in the data port, and that the card is fully seated.

### Which TraceCore card should I use for MemProcFS?

Either works. With the 75T ({{price:tracecore-75t}}) or the 100T Pro ({{price:tracecore-100t-pro}}), read speed is set mainly by the USB link, not the FPGA size; the [35T vs 75T vs 100T comparison](/guides/artix-7-35t-vs-75t-vs-100t) explains when the extra logic matters. Both are on the [DMA cards page](/shop/dma).
