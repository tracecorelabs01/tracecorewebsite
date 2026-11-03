---
title: "Pixel Clock and Bandwidth: Will a Video Fuser Run Your Monitor?"
description: "Work out your monitor's pixel clock and data rate, compare it with HDMI 2.0, DP 1.4 and HDMI 2.1 limits, and see which video fuser modes need DSC."
section: "fuser"
kind: "guide"
seo_title: "Pixel Clock Calculator Guide for Video Fuser Bandwidth"
related_products: ["d60-4k-fuser", "tracecore-dc505", "dc1a686-fuser", "godlike-4k-fuser", "dichen-fuser"]
sort_order: 5
reviewed_by: "TraceCoreLab team"
---
A video fuser can pass a mode only if that mode's data rate fits inside the link between the graphics card, the video fuser and the monitor. The data rate is the pixel clock (horizontal total × vertical total × refresh rate) multiplied by the bits per pixel. At 8-bit RGB, HDMI 2.0 tops out at 600 MHz of pixel clock, DisplayPort 1.4 at about 1080 MHz and HDMI 2.1 FRL 48G at about 1775 MHz, so check your mode with the [pixel clock calculator](/tools/pixel-clock-calculator) before you pick a model.

## The formula

The pixel clock counts the visible pixels plus the blanking interval around them:

**pixel clock = horizontal total × vertical total × refresh rate**

The data rate is the pixel clock multiplied by the bits per pixel: 24 for 8-bit RGB, 30 for 10-bit and 36 for 12-bit.

### Why the totals matter

This guide uses VESA CVT reduced blanking v2 (CVT-RB v2), which adds 80 pixels of horizontal blanking per line and at least 460 µs of vertical blanking per frame. Monitors publish their own timings in their EDID, the data that tells a graphics card which modes the monitor supports, and many high-refresh panels use tighter timings. Your monitor's own timing is the real number.

### Worked example: 1440p at 240 Hz

1. Visible area: 2560 × 1440.
2. CVT-RB v2 totals: 2560 + 80 = 2640 horizontal, 1440 + 179 = 1619 vertical.
3. Pixel clock: 2640 × 1619 × 240 = about 1026 MHz.
4. Data rate at 8-bit RGB: 1026 MHz × 24 = about 24.6 Gbit/s.
5. Result: too much for HDMI 2.0, inside DisplayPort 1.4 and well inside HDMI 2.1 FRL 48G.

## Where to find your monitor's timing

You only need to read the timing; nothing has to be changed.

1. **The monitor's EDID.** EnTech's Monitor Asset Manager and Custom Resolution Utility (CRU) list each detailed timing with its pixel clock. A standard EDID timing entry stops at 655.35 MHz, so faster modes sit in a DisplayID extension block.
2. **The graphics driver.** In NVIDIA Control Panel, open Display, Change resolution, Customize, then Create Custom Resolution; the Timing section shows the total pixels and the pixel clock of the current mode. AMD Software has a Custom Resolutions panel under Display. Close either dialog without saving.
3. **An estimate.** The [pixel clock calculator](/tools/pixel-clock-calculator) gives the CVT-RB v2 figure for any resolution and refresh rate.

> [!TIP]
> If your monitor's pixel clock for a mode is lower than the table below, its timing is tighter than CVT-RB v2, and the mode may fit an interface the table rules out.

## Interface limits

| Interface | Link rate | Data for video | Pixel clock, 8-bit RGB | Pixel clock, 10-bit |
|---|---|---|---|---|
| HDMI 2.0 | 18 Gbit/s (TMDS) | 14.4 Gbit/s | 600 MHz | 480 MHz |
| DisplayPort 1.4 (HBR3) | 32.4 Gbit/s | 25.92 Gbit/s | about 1080 MHz | about 864 MHz |
| HDMI 2.1 FRL 48G | 48 Gbit/s | about 42.6 Gbit/s (42.0 after FEC) | about 1775 MHz | about 1420 MHz |

DisplayPort 1.4 loses a fifth of its raw rate to 8b/10b encoding ([VESA's DisplayPort 1.4 announcement](https://vesa.org/featured-articles/vesa-publishes-displayport-standard-version-1-4/)); HDMI 2.1 uses 16b/18b encoding.

## Vendor guidance for the D60 4K

For the [D60 4K DisplayPort fuser](/product/d60-4k-fuser), the vendor guidance posted in the TraceCoreLab Discord gives three pixel-clock bands. They are vendor guidance, not TraceCoreLab measurements:

| Pixel clock | Vendor guidance |
|---|---|
| Under 1000 MHz | Very likely to work |
| 1000 to 1058 MHz | Can work, possibly with errors or lowered settings |
| 1058 to 1088 MHz | Very likely not to work |

The bands line up with the DisplayPort 1.4 ceiling of about 1080 MHz at 8-bit RGB. 1440p 240 Hz (about 1026 MHz) lands in the middle band, so a monitor with tighter timing has a better chance at that mode.

![DICHEN D60 4K DisplayPort video fuser, black case with a colour status display and a large rotary knob on the front panel](/media/products/2026/10/27bb315c07c7aaf6d582.webp)

## Vendor-listed limits per video fuser

| Model | Top vendor-listed modes | Uncompressed at 8-bit RGB? |
|---|---|---|
| [Dichen Fuser](/product/dichen-fuser) (HDMI) | 1080p 240 Hz, 1440p 144 Hz, 4K 60 Hz | Yes |
| [D60 4K](/product/d60-4k-fuser) (DP 1.4) | 4K 120 Hz, 1440p 240 Hz, 1080p 360 Hz | Yes |
| [GODLIKE 4K Pro](/product/godlike-4k-fuser) (DP) | 4K 120 Hz, 1440p 240 Hz, 1080p 360 Hz | Yes |
| [DC1A686-D3ZC](/product/dc1a686-fuser) (DP 1.4) | 1080p 639 Hz, 1440p 364 Hz, 4K 164 Hz | No, needs DSC |
| [DC505](/product/tracecore-dc505) (HDMI 2.1) | 1080p 550 Hz, 1440p 360 Hz, 4K 160 Hz | Yes |
| [DC505](/product/tracecore-dc505) (DP 1.4) | 1080p 500 Hz, 1440p 320 Hz, 4K 144 Hz | No, needs DSC |

All modes here are vendor-listed, not tested by TraceCoreLab. For prices, capture and cables, see [choosing a video fuser](/guides/choosing-a-video-fuser).

## Worked examples

CVT-RB v2 estimates, data rates in Gbit/s. "All" means HDMI 2.0, DP 1.4 and HDMI 2.1.

| Mode | Pixel clock | 8-bit RGB | 10-bit | Fits uncompressed (8-bit) |
|---|---|---|---|---|
| 1080p 240 Hz | 583 MHz | 14.0 | 17.5 | All |
| 1080p 360 Hz | 932 MHz | 22.4 | 28.0 | DP 1.4, HDMI 2.1 |
| 1080p 500 Hz | 1403 MHz | 33.7 | 42.1 | HDMI 2.1 |
| 2560 × 1080, 200 Hz | 628 MHz | 15.1 | 18.8 | DP 1.4, HDMI 2.1 |
| 1440p 144 Hz | 587 MHz | 14.1 | 17.6 | All |
| 1440p 165 Hz | 679 MHz | 16.3 | 20.4 | DP 1.4, HDMI 2.1 |
| 1440p 240 Hz | 1026 MHz | 24.6 | 30.8 | DP 1.4, HDMI 2.1 |
| 1440p 360 Hz | 1640 MHz | 39.4 | 49.2 | HDMI 2.1 |
| 3440 × 1440, 180 Hz | 995 MHz | 23.9 | 29.8 | DP 1.4, HDMI 2.1 |
| 4K 60 Hz | 523 MHz | 12.5 | 15.7 | All |
| 4K 120 Hz | 1076 MHz | 25.8 | 32.3 | DP 1.4 (at the limit), HDMI 2.1 |
| 4K 144 Hz | 1306 MHz | 31.3 | 39.2 | HDMI 2.1 |

4K 120 Hz needs 25.8 of the 25.92 Gbit/s DisplayPort 1.4 carries, with almost nothing to spare. 4K 144 Hz needs about 31.3 Gbit/s: DSC on DisplayPort, or HDMI 2.1 FRL 48G.

## 10-bit colour

10-bit colour multiplies the data rate by 1.25, and 12-bit by 1.5. A mode that fits at 8-bit can stop fitting at 10-bit: 4K 120 Hz goes from 25.8 to about 32.3 Gbit/s, past DisplayPort 1.4's uncompressed limit. HDR output uses 10-bit, so turn HDR off on both sources when a mode sits near the limit.

> [!NOTE]
> Keep both sources at 8-bit RGB unless you need HDR. It also avoids the pink or green tint covered in troubleshooting.

## DSC

Display Stream Compression (DSC) 1.2 arrived with DisplayPort 1.4 and compresses video up to 3:1 in a way VESA describes as visually lossless. The top vendor-listed modes of the DC1A686-D3ZC and the DC505's DisplayPort mode depend on it, and it only helps when both graphics cards, the video fuser and the monitor all support it. Otherwise plan on roughly 1080p 400 Hz, 1440p 250 Hz or 4K 120 Hz at 8-bit RGB on DisplayPort 1.4.

Chroma subsampling (4:2:2 or 4:2:0) also cuts the data rate, but small overlay text looks soft.

## "HDMI 2.1" does not guarantee FRL 48G

HDMI 2.1 features are optional. A graphics card or monitor sold as HDMI 2.1 may run Fixed Rate Link (FRL) at a lower rate such as 24, 32 or 40 Gbit/s, or only support older TMDS signalling. The DC505's HDMI 2.1 modes need FRL at 48 Gbit/s, its "12G × 4" mode, on both graphics cards and the monitor, plus [Ultra High Speed HDMI cables](https://www.hdmi.org/spec21sub/ultrahighspeedcable). [DisplayPort and HDMI 2.1 video fuser setup](/guides/displayport-and-hdmi-2-1-fuser-setup) covers the cabling.

## Use the calculator

1. Open the [pixel clock calculator](/tools/pixel-clock-calculator).
2. Enter your monitor's resolution and the refresh rate you want.
3. Pick 8-bit or 10-bit colour.
4. Read the pixel clock, the data rate and which interfaces carry it, then compare with the vendor-listed modes in the [video fuser range](/shop/fuser).

If a mode still fails after the numbers check out, see [video fuser troubleshooting](/guides/video-fuser-troubleshooting).

## FAQ

### What is pixel clock?

Pixel clock is the number of pixels a graphics card sends per second, including the blanking interval. It equals the horizontal total times the vertical total times the refresh rate, and it sets how much bandwidth a mode needs.

### How much bandwidth does 4K 144 Hz need over DP 1.4?

About 31.3 Gbit/s at 8-bit RGB with CVT-RB v2 timing. DisplayPort 1.4 carries 25.92 Gbit/s uncompressed, so 4K 144 Hz over DP 1.4 needs DSC.

### Is HDMI 2.1 48 Gbps enough for 1440p 360 Hz?

Yes, at 8-bit RGB. 1440p 360 Hz needs about 39.4 Gbit/s, inside the roughly 42 Gbit/s that FRL 48G leaves for video, as long as every device supports FRL at 48 Gbit/s.

### Why does my monitor's pixel clock differ from the calculator?

The calculator uses CVT-RB v2 timing, while your monitor's EDID can use tighter or looser blanking. The monitor's own figure is the one that counts.
