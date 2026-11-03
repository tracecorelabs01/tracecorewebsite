---
title: "Install the Thermal Kit on a DMA Card: Heatsink and Thermal Pads"
description: "Fit the Thermal Kit to a TraceCore 75T DMA card: when extra FPGA cooling helps, cleaning the chip, placing the 1.5 mm thermal pads and clipping on the heatsink."
section: "dma"
kind: "guide"
seo_title: "FPGA Heatsink Install: Fit the DMA Card Thermal Kit"
related_products: ["thermal-kit", "tracecore-75t"]
sort_order: 23
reviewed_by: "TraceCoreLab team"
---

The [Thermal Kit](/product/thermal-kit) adds a clip-on finned aluminium heatsink and pre-cut 1.5 mm thermal pads to a TraceCore 75T DMA card. You remove the card, clean the FPGA, place the pads, clip the heatsink on and reinstall. The clips need no tools; a screwdriver is only for the case and bracket screw.

> [!NOTE]
> Use a DMA card only on computers you own or are authorized to examine.

## When you need extra cooling

The FPGA warms up under long, continuous work. The Thermal Kit helps when:

- you run sustained workloads, such as full memory acquisitions or long MemProcFS forensic sessions
- the case is small or has little airflow around the expansion slots
- the card sits next to a graphics card or another component that sheds hot air
- the card drops its connection only after running for a while, and works again once cool

For that last symptom, rule out the cable and USB port first with [DMA card troubleshooting](/guides/dma-card-troubleshooting).

The kit is listed for the [TraceCore 75T](/product/tracecore-75t). The TraceCore 100T Pro already ships with its own aluminium heatsink.

![TraceCore 75T FPGA DMA card, the board the Thermal Kit heatsink fits](/media/products/2026/11/c1b05e21801b9fa1f87d.webp)

## What's in the kit

| Item | Details |
|---|---|
| Heatsink | Finned, anodised aluminium |
| Thermal pads (x2) | Pre-cut, 1.5 mm thick, 6 W/mK |
| Retention clips | Tool-free mounting |

The kit is {{price:thermal-kit}}; other add-ons are on the [accessories page](/shop/accessory).

## What you need

- The Thermal Kit and your TraceCore 75T
- A screwdriver for the case and the card's bracket screw
- Isopropyl alcohol (90% or stronger) and a lint-free cloth
- A clean, dry work surface with an anti-static bag or mat

## Step 1: Power down and remove the card

1. Shut down the target system, switch off the power supply and unplug the power cord.
2. Unplug the USB-C data cable from the card.
3. Touch bare metal on the case to discharge static, or wear an anti-static wrist strap.
4. Remove the bracket screw, hold the card by its edges and lift it straight out of the slot.
5. Lay it component side up on the anti-static bag or mat.

## Step 2: Clean the FPGA surface

The FPGA is the largest square chip on the board, marked with a part number that starts with XC7A.

1. Dampen the cloth with isopropyl alcohol; never pour it onto the board.
2. Wipe the top of the FPGA package free of dust and fingerprints.
3. Let it dry completely, and do not touch the cleaned surface.

> [!WARNING]
> If your card already has a heatsink or a pad on the FPGA, stop and ask [support](/support) before removing anything.

## Step 3: Fit the pads

1. Peel the backing film from one side of a pad.
2. Place it centred on the FPGA so it covers the whole top of the package, and press it down lightly.
3. Peel off the top film.
4. Never stack two pads: a double layer conducts heat worse and can stop the clips seating.

> [!NOTE]
> The kit has two pads. If you are not sure where the second pad goes on your card, ask [support](/support) before you mount the heatsink.

## Step 4: Mount the heatsink

1. Orient the heatsink so its fins line up with the case airflow and it does not overhang the bracket or the PCIe edge connector.
2. Lower it straight down onto the pad without sliding it.
3. Fit the retention clips and press until they seat. Never force a clip.
4. Check that the heatsink sits flat, does not rock, and touches nothing except the pads.

The heatsink adds height on the component side, so check that the neighbouring slot leaves room for it.

## Step 5: Reinstall and check temperatures

1. Reinstall the card in a PCIe slot (x1, x4, x8 or x16) and fit the bracket screw. The [install a PCIe DMA card](/guides/install-a-pcie-dma-card) guide covers slot choice.
2. Reconnect the USB-C data cable, then the power cord, and start the system.
3. Run `pcileech probe -v` on the analysis workstation to confirm the card connects, as in the [connection and speed test](/guides/dma-card-connection-and-speed-test).
4. Run a sustained workload, such as `pcileech benchmark` or a full memory acquisition, and confirm it finishes without the card disconnecting.
5. After shutting down, the heatsink should feel warm, which shows heat is moving into the fins.

If the card still drops out under load, check that the pad covers the whole FPGA and the clips hold the heatsink flat.

## FAQ

### Does the Thermal Kit fit the TraceCore 100T Pro?

No. The 100T Pro ships with its own aluminium heatsink; the Thermal Kit is listed for the TraceCore 75T.

### Do I need tools to fit the Thermal Kit?

Not for the kit itself: retention clips hold the heatsink. A screwdriver is only needed for the case and the bracket screw.

### Can I reuse a thermal pad after removing the heatsink?

It is better not to. A pad that has been compressed may not make full contact again, so fit a fresh pad if you remove the heatsink.

### Does fitting the Thermal Kit affect my warranty?

The kit clips on without permanent changes to the card. If you have a warranty question, ask [support](/support) before fitting.
