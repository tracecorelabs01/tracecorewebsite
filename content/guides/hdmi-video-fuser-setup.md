---
title: "HDMI Video Fuser Setup: Dichen Fuser and DC1A255-H3 Step by Step"
description: "Set up an HDMI video fuser: match both PCs, connect the cables, read the LEDs and keys, let EDID adapt and set the refresh rate, with a stream-graphics example."
section: "fuser"
kind: "guide"
seo_title: "HDMI Video Fuser Setup Guide: Dichen Fuser and DC1A255-H3"
related_products: ["dichen-fuser", "dichen-dc1a255"]
sort_order: 2
reviewed_by: "TraceCoreLab team"
---

To set up an HDMI video fuser, set both PCs to the same resolution and refresh rate, connect PC 1 to the host input, PC 2 to the secondary input and the output to the monitor, then connect power. Leave EDID on automatic, turn fusion on and raise the keying strength until the overlay's background is clean. This guide covers the [Dichen Fuser](/product/dichen-fuser) and the [DC1A255-H3](/product/dichen-dc1a255), with a stream-graphics overlay as the example.

## What you need

- **An HDMI video fuser:** the Dichen Fuser or the DC1A255-H3.
- **Two PCs with HDMI outputs:** PC 1 (the main PC) for the program picture and PC 2 (the second PC) for the overlay graphics.
- **A monitor with an HDMI input** that supports the mode you plan to run.
- **Three HDMI cables**, certified as Premium High Speed HDMI (18 Gbit/s) for modes such as 1080p 240 Hz or 4K 60 Hz. The DC1A255-H3 ships with two HDMI cables and a power adapter; for the Dichen Fuser, check the box list on the product page.
- **Power:** Dichen's manual for its 5th and 6th generation HDMI fusers specifies 12 V 2 A on the DC12V socket.
- **Overlay graphics on PC 2:** any full-screen page or projector on a solid background in your model's key colour.

## Step 1: Match resolution and refresh

Before you connect anything, set PC 1 and PC 2 to the same resolution and refresh rate, using a mode the monitor supports and the HDMI fuser lists:

| Resolution | Dichen Fuser | DC1A255-H3 |
|---|---|---|
| 1920 × 1080 | up to 240 Hz | up to 240 Hz |
| 2560 × 1080 | up to 200 Hz | not listed |
| 2560 × 1440 | up to 144 Hz | up to 144 Hz |
| 3440 × 1440 | up to 100 Hz | up to 100 Hz (listed as 3K) |
| 3840 × 2160 | up to 60 Hz | up to 60 Hz |

All modes in this table are vendor-listed.

> [!NOTE]
> HDMI 2.0 carries a pixel clock of about 600 MHz. 2560 × 1080 at 200 Hz needs about 628 MHz with standard reduced-blanking timing, so it depends on the monitor's own tighter timing; 180 Hz needs about 560 MHz and fits. Check any mode with the [pixel clock calculator](/tools/pixel-clock-calculator).

## Step 2: Connect

Dichen's manual for its 5th and 6th generation HDMI fusers labels the ports like this:

| Port | Connect to |
|---|---|
| HDMI Output | The monitor |
| HDMI1 Host | PC 1's graphics card (main picture) |
| HDMI2 Secondary | PC 2's graphics card (overlay graphics) |
| Type-C | Configuration port, not needed for normal use |
| DC12V | Power, 12 V 2 A |

1. Connect the monitor to **HDMI Output**.
2. Connect PC 1 to **HDMI1 Host**, using the graphics card's HDMI port rather than the motherboard's.
3. Connect PC 2 to **HDMI2 Secondary**.
4. Connect power last.

The DC1A255-H3 has three HDMI 2.0 ports: two inputs and one output. Match its port labels to the same roles using the manual in the box.

> [!TIP]
> If the main picture and the overlay come out the wrong way round, swap the two input cables. The secondary input is the one keyed on top.

## Step 3: Power on and read the LEDs

| LED (5th and 6th generation) | Meaning |
|---|---|
| D1 | Steady when the unit has power |
| H1 | Signal present on HDMI1 (PC 1) |
| H2 | Signal present on HDMI2 (PC 2) |
| D2 | Fusion is on |

If H1 or H2 stays off, that input has no signal: check the cable and that the PC is awake with its HDMI output enabled. The DC1A255-H3's LEDs are labelled power, host, secondary and fusion; confirm them in its manual.

## Step 4: Learn the buttons

The key map from Dichen's 5th and 6th generation manual:

| Key | Short press | Long press (2 s) |
|---|---|---|
| K1 | Shows the current resolution and refresh (top line: host, bottom line: secondary) | Switches between automatic and manual EDID (automatic is the default) |
| K2 | Steps the keying ("cutout") strength through 21 levels, 0 to 20 (default 0) | Not listed |
| K3 | Resets K2 to the default | Not listed |
| K4 | Turns fusion on or off | Shows only the secondary picture |

Check that the labels on your unit match before relying on this map. The DC1A255-H3 labels its keys X1 to X4; use the manual that ships with it for their functions.

## Step 5: Let EDID adapt

EDID is the data a monitor sends to list the modes it supports. These units give both PCs a matching mode list automatically.

1. Make sure EDID is on automatic. It is the default; if you held K1 for 2 seconds earlier, hold it for 2 seconds again to switch back.
2. With the monitor on, disconnect and reconnect the HDMI fuser's power so it reads the monitor again.
3. Press K1 briefly. Both lines should show the mode you set in Step 1.

The DC1A255-H3 uses native EDID passthrough, so both PCs see the monitor's own modes with nothing to set. If a mode is still missing, follow the [resolution and refresh guide](/guides/video-fuser-resolution-and-refresh).

> [!WARNING]
> Manual EDID mode and the Type-C configuration port are not needed for a normal setup and are not covered here. If you ever open the vendor's configuration tool, never press its firmware-update button.

## Step 6: Set the refresh rate on both sources

Windows often picks 60 Hz after a new display connects, so set the rate on each PC:

1. **Windows 11:** Settings > System > Display > Advanced display, choose the display, then pick the rate under "Choose a refresh rate". On Windows 10 the page is called Advanced display settings.
2. Repeat on PC 2 with exactly the same value.
3. Press K1 to confirm both inputs report the same mode.

Also set both PCs to 8-bit RGB, full range, in the NVIDIA or AMD control panel.

## Example: a stream-graphics overlay

1. On PC 2, build a full-screen page with a lower-third (a name and title bar) and a clock in one corner, on a solid background in your model's key colour.
2. Show it full screen on the output that goes to the HDMI fuser.
3. On PC 1, play the program feed: slides, a video or a camera.
4. Press K4 to turn fusion on. D2 lights up.
5. Hold K4 for 2 seconds to view only the secondary picture and check the layout, then press K4 again to return to the fused view.
6. Press K2 to raise the keying strength one step at a time until the halo around the text disappears. If you overshoot, K3 resets it.

## Model notes

### Dichen Fuser

Automatic EDID adaptation and vendor-listed modes from 1080p 240 Hz to 4K 60 Hz. The listing gives no model number, so check your unit's key and LED labels against the map above.

### DC1A255-H3

![DICHEN DC1A255-H3 HDMI 2.0 video fuser, grey metal case with DCKJ logo, front power switch, four status LEDs and keys X1 to X4](/media/products/2026/11/08f0954eb86392112c53.webp)

Three HDMI 2.0 ports (two inputs, one output) with native EDID passthrough. It carries HDMI DDC, HPD, CEC and HDCP signalling (vendor-listed), and every listed mode fits HDMI 2.0's 600 MHz pixel clock.

## Next steps

- Missing a mode: [fix wrong resolution or refresh rate](/guides/video-fuser-resolution-and-refresh).
- Planning a higher mode: [pixel clock and video fuser bandwidth](/guides/pixel-clock-and-fuser-bandwidth).
- Black screen, flicker or tint: [video fuser troubleshooting](/guides/video-fuser-troubleshooting).
- Need DisplayPort or HDMI 2.1: [DisplayPort and HDMI 2.1 video fuser setup](/guides/displayport-and-hdmi-2-1-fuser-setup), or compare models in the [video fuser shop](/shop/fuser).

Port, LED and key details come from [Dichen's video fuser guide](https://dichen.store/blogs/tutorial/dichen-fuser-guide).

## FAQ

### Which HDMI input carries the main picture?

HDMI1 Host carries the main picture from PC 1, and HDMI2 Secondary carries the overlay from PC 2, keyed on top.

### Why is there a thin outline around my overlay text?

Anti-aliased edges are close to the key colour without matching it. Press K2 to raise the keying strength one step at a time, and press K3 to return to the default if the graphics start to break up.

### Can I run 1440p 144 Hz through an HDMI fuser?

Yes. 2560 × 1440 at up to 144 Hz is vendor-listed for both the Dichen Fuser and the DC1A255-H3, and it needs about 587 MHz, inside HDMI 2.0's limit.

### Why is the picture pink or purple?

One of the PCs is sending YCbCr instead of RGB. Set both PCs to 8-bit RGB, full range, in the NVIDIA or AMD control panel.
