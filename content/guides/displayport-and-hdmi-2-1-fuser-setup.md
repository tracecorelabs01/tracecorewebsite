---
title: "DisplayPort and HDMI 2.1 Video Fuser Setup: D60, DC1A686, DC505"
description: "Set up a DisplayPort or HDMI 2.1 video fuser: cables, pixel clock checks, second-PC needs and notes for the D60 4K, DC1A686, GODLIKE 4K Pro and DC505."
section: "fuser"
kind: "guide"
seo_title: "DisplayPort Fuser Setup: DP 1.4 and HDMI 2.1 Video Fusers"
related_products: ["d60-4k-fuser", "dc1a686-fuser", "godlike-4k-fuser", "tracecore-dc505"]
sort_order: 3
reviewed_by: "TraceCoreLab team"
---

A DisplayPort fuser needs DisplayPort 1.4 on both graphics cards and the monitor, certified HBR3 cables, and a mode whose pixel clock fits the link: about 1080 MHz at 8-bit RGB, which is enough for 4K 120 Hz. In HDMI 2.1 mode, the DC505 goes further, but every device in the chain must support FRL at 48 Gbit/s. Check the pixel clock first, connect PC 1, PC 2 and the monitor, then confirm the overlay with a test pattern.

## What you need

- **A DisplayPort or HDMI 2.1 video fuser:** the [D60 4K](/product/d60-4k-fuser), [DC1A686-D3ZC](/product/dc1a686-fuser), [GODLIKE 4K Pro](/product/godlike-4k-fuser) or [DC505](/product/tracecore-dc505).
- **Two PCs with matching outputs:** PC 1 (the main PC) for the program picture and PC 2 (the second PC) for the overlay graphics.
- **A monitor** with the same interface and support for the mode you plan to run.
- **Three cables rated for the link:** certified DP 1.4 (HBR3) cables, which VESA certifies under the DP8K name, or [Ultra High Speed HDMI cables](https://www.hdmi.org/spec21sub/ultrahighspeedcable) for 48 Gbit/s HDMI 2.1.
- **The power supply from the box.** Each of these models ships with its own.

| Model | Link | Sources and monitor | Cables in the box |
|---|---|---|---|
| D60 4K | DP 1.4 (HBR3) | DP 1.4; HDMI 2.1 output on the overlay source for high-refresh modes (vendor-listed) | None listed |
| DC1A686-D3ZC | 3 × DP 1.4 | DP 1.4; DSC for the top modes | None listed |
| GODLIKE 4K Pro | DisplayPort | DisplayPort; minimum overlay-source GPU is vendor-listed | 2 DP cables |
| DC505 | HDMI 2.1 (FRL 48 Gbit/s) or DP 1.4 | One interface family on every port | None listed |

## Check the pixel clock first

Pixel clock is horizontal total × vertical total × refresh rate, including blanking. The data rate is about pixel clock × 24 at 8-bit RGB, or × 30 at 10-bit.

- **DisplayPort 1.4 (HBR3):** 32.4 Gbit/s raw and 25.92 Gbit/s for video, about 1080 MHz at 8-bit RGB.
- **HDMI 2.1 (FRL 48 Gbit/s):** about 42.6 Gbit/s of data, about 1775 MHz at 8-bit RGB.

| Mode | Pixel clock | 8-bit RGB | DP 1.4 uncompressed | HDMI 2.1 48 Gbit/s |
|---|---|---|---|---|
| 1920 × 1080 at 360 Hz | 932 MHz | 22.4 Gbit/s | Yes | Yes |
| 1920 × 1080 at 500 Hz | 1403 MHz | 33.7 Gbit/s | No, needs DSC | Yes |
| 2560 × 1440 at 240 Hz | 1026 MHz | 24.6 Gbit/s | Yes, close to the limit | Yes |
| 2560 × 1440 at 360 Hz | 1640 MHz | 39.4 Gbit/s | No, needs DSC | Yes |
| 3840 × 2160 at 120 Hz | 1076 MHz | 25.8 Gbit/s | Yes, at the limit | Yes |
| 3840 × 2160 at 144 Hz | 1306 MHz | 31.4 Gbit/s | No, needs DSC | Yes |
| 3840 × 2160 at 160 Hz | 1463 MHz | 35.1 Gbit/s | No, needs DSC | Yes |

These are approximate CVT reduced-blanking v2 values. Your monitor uses its own timings, so enter its exact mode in the [pixel clock calculator](/tools/pixel-clock-calculator); the [pixel clock and video fuser bandwidth guide](/guides/pixel-clock-and-fuser-bandwidth) explains the method.

Display Stream Compression (DSC 1.2) arrived with [DisplayPort 1.4, per VESA](https://vesa.org/featured-articles/vesa-publishes-displayport-standard-version-1-4/), and compresses up to 3:1. A mode marked "needs DSC" only works when both graphics cards, the video fuser and the monitor all support it.

> [!NOTE]
> 10-bit colour multiplies the data rate by 1.25. 4K 120 Hz at 10-bit needs about 32.3 Gbit/s, over the DP 1.4 limit without DSC, so run 8-bit RGB for the highest uncompressed modes.

## Connect

Inputs are often marked host and secondary (or RX0 and RX1) and the output TX or OUT. Take the exact labels from the manual in the box.

1. Leave the video fuser unpowered while you cable it.
2. Connect the output port to the monitor.
3. Connect PC 1's graphics card to the first (host) input for the main picture.
4. Connect PC 2's graphics card to the second (secondary) input for the overlay.
5. Connect power and wait for the status LEDs or display to show both inputs.
6. Set PC 1 and PC 2 to the same resolution and refresh rate, unless your model accepts different resolutions (the DC1A686-D3ZC does).

> [!NOTE]
> The D60 4K listing gives "dual DP" ports with "HDMI 2.1 and DP 1.4" signal compatibility, and asks for an HDMI 2.1 output on the overlay source for high-refresh modes. Check the port labels and the manual to see which port takes which source before you cable it.

## Graphics-source requirements

The second PC's graphics card must reach the same mode on the same interface.

- **GODLIKE 4K Pro:** the overlay source needs AMD RX 470, NVIDIA RTX 2060 or AMD Radeon 780M integrated graphics, or newer (vendor-listed).
- **D60 4K:** an HDMI 2.1 output on the overlay source for high-refresh operation (vendor-listed).
- **DC505 in HDMI mode:** FRL at 48 Gbit/s on both graphics cards and the monitor. HDMI 2.1 features are optional, so check the specification sheet for FRL 48 Gbit/s, not just the HDMI 2.1 label.
- **DSC modes:** both graphics cards and the monitor must support DSC.
- **NVIDIA RTX 50 Series:** the DC505 is vendor-listed as flicker-free. Some laptops with an RTX 5070 Ti or newer GPU need its 12G × 4 mode (HDMI 2.1 FRL at 48 Gbit/s).

For a clean key, set both PCs to 8-bit RGB, full range, in the NVIDIA or AMD control panel.

## Model notes

### D60 4K

![DICHEN D60 4K DisplayPort video fuser, black case with a colour status display and a large rotary knob on the front panel](/media/products/2026/10/27bb315c07c7aaf6d582.webp)

| Resolution | Vendor-listed | DP 1.4 at 8-bit RGB |
|---|---|---|
| 3840 × 2160 | up to 120 Hz, RGB | Fits, at the limit |
| 2560 × 1440 | up to 240 Hz | Fits |
| 1920 × 1080 | up to 360 Hz | Fits |
| 3440 × 1440 | 144 to 180 Hz, monitor-dependent | Fits |
| 3840 × 1080 | up to 120 Hz | Fits |

The D60 4K adapts resolution and refresh rate automatically and has a full-colour front display with a rotary knob. The vendor lists two verified monitors: the AOC CU34G3X at 3440 × 1440, 165 Hz and the Skyworth 44C1G at 3840 × 1080, 120 Hz.

### DC1A686-D3ZC

| Resolution | Vendor-listed | DP 1.4 uncompressed tops out near |
|---|---|---|
| 1920 × 1080 | up to 639 Hz | 406 Hz |
| 2560 × 1440 | up to 364 Hz | 251 Hz |
| 3440 × 1440 | up to 264 Hz | 193 Hz |
| 3840 × 2160 | up to 164 Hz | 120 Hz |
| 1280 × 720 | 1000 Hz and above | 730 Hz |

Every headline mode needs DSC on the graphics cards and the monitor. Three DP 1.4 ports give two inputs and one output, with native EDID passthrough. The vendor also lists different resolutions per input with scaling, RGB and YCbCr at 8, 10 or 12 bits, and 1080p 60 Hz capture with audio.

### GODLIKE 4K Pro

Vendor-listed modes: 3840 × 2160 at 60 or 120 Hz, 2560 × 1440 at 144 or 240 Hz, 1920 × 1080 at 144, 165, 240 or 360 Hz, 2560 × 1080 at 165 Hz and 3440 × 1440 at 60 Hz. All of them fit DP 1.4 at 8-bit RGB. Full 4:4:4 chroma keeps small text and thin lines in overlays sharp. It comes with a remote control, front buttons labelled TR, RES, CH and FUSION, a 12 V 2 A power adapter and two DP cables; the button functions are in its manual.

### DC505: HDMI and DP modes, capture

![DICHEN DC505 video fuser in a white metal case with a round top vent, K1 to K4 keys, status LEDs and a USB-C port labelled Collect](/media/products/2026/10/62da4dd63cb143a7608a.webp)

| Resolution | HDMI 2.1 mode (FRL 48 Gbit/s) | DisplayPort 1.4 mode |
|---|---|---|
| 1920 × 1080 | up to 550 Hz, fits uncompressed | up to 500 Hz, needs DSC |
| 2560 × 1440 | up to 360 Hz, fits uncompressed | up to 320 Hz, needs DSC |
| 3840 × 2160 | up to 160 Hz, fits uncompressed | up to 144 Hz, needs DSC |

All DC505 modes are vendor-listed. The common HDMI modes are 1080p 500 Hz, 1440p 320 Hz and 4K 144 Hz, and the top modes depend on monitor timing. Over DisplayPort, some monitors stop at 1080p 480 Hz, 1440p 240 Hz or 4K 120 Hz.

- **One interface at a time:** run HDMI 2.1 on both sources and the monitor, or DP 1.4 throughout. The vendor lists the two modes separately, and mixed cabling is not a listed configuration.
- **EDID modes:** Adaptive, Native and Custom. Start with Adaptive; switch to Native to give both sources the monitor's own mode list.
- **Capture:** 1080p 60 Hz video with audio, from one input directly or from the fused picture, while the overlay keeps running. The product photo shows a front USB-C port labelled Collect; confirm the capture connection and recording steps in the DC505 manual.

## Verify the overlay with a test pattern

1. On PC 1, open a full-screen test pattern with colour bars and a fine grid.
2. On PC 2, open a test overlay: a white text box with a thin border, like a lower-third, on a solid background in your model's key colour.
3. Turn fusion on with the model's fusion control (FUSION on the GODLIKE 4K Pro; see the manual for the others).
4. Check that the background is fully gone and the text edges are clean. Adjust the keying strength if a halo remains.
5. Check that the grid lines stay sharp. Soft or coloured lines usually mean one PC is not sending 8-bit RGB.
6. Watch for a few minutes. Flicker or dropouts point to a cable or a mode over the link limit; drop the refresh rate one step and test again.
7. Confirm the mode in the monitor's menu, then switch PC 2 to your real graphics.

If a mode is missing, follow [fix wrong resolution or refresh rate](/guides/video-fuser-resolution-and-refresh). For other faults, see [video fuser troubleshooting](/guides/video-fuser-troubleshooting), and to compare models, read [choosing a video fuser](/guides/choosing-a-video-fuser).

## FAQ

### Do I need DSC for 4K 144 Hz over DisplayPort 1.4?

Yes. 4K 144 Hz at 8-bit RGB needs about 31.4 Gbit/s, and DP 1.4 carries 25.92 Gbit/s of video, so the graphics cards, the video fuser and the monitor must all support DSC. 4K 120 Hz fits without it.

### Can PC 1 and PC 2 run different resolutions?

Only on the DC1A686-D3ZC, which is vendor-listed as accepting different resolutions with scaling. The other models need the same resolution and refresh rate on both PCs.

### Does every HDMI 2.1 port support 48 Gbit/s?

No. HDMI 2.1 features are optional, so a port can carry the HDMI 2.1 label with a lower FRL rate. The DC505's HDMI modes need FRL at 48 Gbit/s on both graphics cards and the monitor.

### Can I mix HDMI and DisplayPort on the DC505?

Plan on one interface family for all three connections. The DC505's HDMI 2.1 and DisplayPort 1.4 modes are listed separately, and mixed cabling is not a listed configuration.
