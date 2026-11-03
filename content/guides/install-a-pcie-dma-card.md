---
title: "DMA Card Setup: How to Install a PCIe DMA Card in a Target PC"
description: "Install a PCIe DMA card step by step: choose a slot, swap the bracket, seat the card, set the enable switch and connect the USB-C data port to the analysis PC."
section: "dma"
kind: "guide"
seo_title: "How to Install a PCIe DMA Card: 75T and 100T Pro Setup"
related_products: ["tracecore-75t", "tracecore-100t-pro", "heino-2", "usb-c-data-cable", "thermal-kit"]
sort_order: 2
reviewed_by: "TraceCoreLab team"
---

A PCIe DMA card installs like any other expansion card: it goes into a free PCIe slot in the target PC, and a USB-C cable links its data port to a USB 3 port on the analysis PC that runs PCILeech. You need a screwdriver and a few minutes, and nothing gets installed on the target PC itself. This guide covers the TraceCore 75T and TraceCore 100T Pro, both PCIe x1 FPGA development boards built on the Xilinx Artix-7.

Use a DMA card only on computers you own or are authorized to examine.

![TraceCore 75T PCIe DMA card, a Xilinx Artix-7 FPGA development board with a USB-C data link](/media/products/2026/11/c1b05e21801b9fa1f87d.webp)

## What you need

- **The target PC:** a desktop with a free PCIe slot. Any x1, x4, x8 or x16 slot works.
- **The analysis PC:** a Windows or Linux computer with a USB 3 port. A laptop is fine here, and the [DMA Mini PC](/product/dma-mini-pc) is a compact option if you want a dedicated machine.
- **The card:** a [TraceCore 75T](/product/tracecore-75t) or [TraceCore 100T Pro](/product/tracecore-100t-pro). Each ships with the full-height bracket fitted and a low-profile bracket in the box.
- **A cable:** the 1 m USB-C cable from the box, or the 2 m or 3 m [USB-C 3.2 Data Cable](/product/usb-c-data-cable) if the two PCs sit further apart.
- **Tools:** a screwdriver for the case and bracket screws, and an anti-static wrist strap if you have one.

## Step 1: Power down safely

1. Shut down the target PC from the operating system. Sleep and hibernate are not enough.
2. Switch off the power supply at its rear switch and unplug the power cord.
3. Press the case power button once to drain any charge left in the system.
4. Touch bare metal on the case to discharge static. Hold the card by its edges and bracket, never by the gold contacts.

> [!WARNING]
> Never fit or remove a PCIe card with the power cord connected. Many motherboards keep standby power on the slots even when the PC looks switched off.

## Step 2: Choose a slot

Both TraceCore cards are PCIe x1 cards. A x1 card fits and works in any x1, x4, x8 or x16 slot, and PCILeech FPGA designs link at x1 even in a longer slot, so a bigger slot gives no extra speed. PCIe is also backward compatible, so the card works in PCIe 3.0, 4.0 and 5.0 slots.

| Slot | Works | Notes |
|---|---|---|
| x1 | Yes | The best choice. It leaves the larger slots free. |
| x4 or x8 | Yes | No difference in speed. |
| x16 | Yes | Use a secondary x16 slot. The first one usually holds the graphics card. |
| Slot that shares lanes with an M.2 socket | Check first | Some motherboards switch a slot off when the M.2 socket next to it holds a drive. The motherboard manual lists these pairs. |

Pick a slot with some space around it, away from the graphics card's exhaust. For slot generations, small cases and laptops, see the [DMA card compatibility guide](/guides/dma-card-compatibility).

## Step 3: Swap the bracket if needed

The full-height bracket fits standard tower and desktop cases. Small form factor cases with half-height slots need the low-profile bracket from the box. You can also pick which bracket comes fitted when you order.

1. Remove the screws that hold the bracket to the card and keep them.
2. Lift the full-height bracket away from the card.
3. Fit the low-profile bracket so its openings line up with the USB-C port and the switch.
4. Refit the screws firmly, without overtightening them.

## Step 4: Seat and secure the card

1. Remove the slot cover behind the slot you picked.
2. Line the card's gold contacts up with the slot and press straight down with even pressure on both ends until the card is fully in. No gold should show above the slot.
3. If the slot has a retention latch, check that it has closed.
4. Screw the bracket to the case.

> [!TIP]
> The card should not move when you plug the cable in. A card that shifts in the slot can lose its PCIe link, and then the target PC no longer lists it.

## Step 5: Set the enable switch to ON

The 75T and the 100T Pro both have an enable switch, often called a kill switch, on the I/O panel at the bracket end of the card. You can reach it from the back of the case without opening the PC. It switches the card on or off without unplugging it.

1. Set the switch to the enabled position before you power on the target PC, so the card is present when the target starts.
2. If the positions are not marked on your bracket, check the quick-start card in the box or ask us through [support](/support).

> [!NOTE]
> With the switch at disabled, the card stays in the slot but PCILeech cannot read through it. When reads fail, the switch position is the first thing to check.

## Step 6: Connect the data port

1. Plug the USB-C cable into the card's data port. If your board has a second USB-C port, that one is for JTAG programming and is not used with PCILeech. The bracket label or the quick-start card shows which port is which.
2. Plug the other end into a USB 3 port on the analysis PC. The 75T's USB 3 data link works in USB 3.1 and USB 3.2 ports, Gen 1 and Gen 2.
3. Use a rear motherboard port. Hubs, front-panel ports and docks often run at USB 2 speed.
4. Route the cable so its weight does not pull on the card.

A USB 2 port still lets the card connect, but much more slowly: PCILeech warns when reads drop below 45 MB/s. The [connection and speed test guide](/guides/dma-card-connection-and-speed-test) shows how to check.

## Step 7: Power on and check the LEDs

1. Close the case, reconnect the power cord and switch the power supply on.
2. Power on the target PC first, then the analysis PC (or leave the analysis PC running).
3. Look at the card's LEDs. A lit LED shows the card is getting power from the slot. LED colours and positions differ between boards, so the [troubleshooting guide](/guides/dma-card-troubleshooting) describes LED states rather than colours.
4. On a Windows analysis PC, a new USB device should appear within a few seconds of the target starting.

## Heino 2.0 differences

The [Heino 2.0](/product/heino-2) is a third-party standalone DMA device, not a TraceCore PCIe card, so the slot, bracket and port steps above may not match it. Follow the documentation supplied with it, and contact us before you start if anything is unclear. Like our own cards, it carries a 3-month warranty from TraceCoreLab.

## Cooling for long sessions

For long, sustained workloads in a cramped case, the [Thermal Kit](/product/thermal-kit) adds a clip-on aluminium heatsink and pre-cut thermal pads for the 75T. Fitting takes a few minutes and no tools: see [how to install the Thermal Kit](/guides/install-dma-card-thermal-kit). The 100T Pro already carries its own aluminium heatsink, so the kit is not needed there.

## Next: drivers and PCILeech

With the card installed, set up the analysis PC: the FT601 driver, the FTDI DLL and PCILeech. Follow the [FT601 driver and PCILeech setup guide](/guides/ft601-driver-and-pcileech-setup), then run the [connection and speed test](/guides/dma-card-connection-and-speed-test). To compare boards first, browse all [PCIe DMA cards](/shop/dma) and [accessories](/shop/accessory).

## FAQ

### Does a PCIe x1 DMA card work in a x16 slot?

Yes. A x1 card fits any longer slot and works there, but PCILeech FPGA designs link at x1 whichever slot you use, so a x16 slot adds no speed.

### Which USB-C port on the card do I connect?

The data port. If your board has two USB-C ports, the second one is for JTAG programming and is not used with PCILeech.

### Do I need to open the case to switch the card off?

No. The enable switch sits on the I/O panel at the bracket end of the card, so you can reach it from the back of the case. It disables the card without unplugging it.

### Can I use a front-panel USB port on the analysis PC?

It may work, but front-panel ports and hubs often fall back to USB 2 speed. A rear USB 3 port on the motherboard gives the most reliable link.

### Does the target PC need drivers for the DMA card?

No. PCILeech reads memory over PCIe without any driver on the target PC. All software runs on the analysis PC.
