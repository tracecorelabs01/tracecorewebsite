---
title: "Fix Wrong Resolution or Refresh Rate Through a Video Fuser"
description: "Missing 144 Hz or the wrong resolution through a video fuser? Use auto-adapt and EDID modes first, add a timing with CRU, then check the pixel clock limit."
section: "fuser"
kind: "guide"
seo_title: "Video Fuser Wrong Resolution or Refresh Rate: How to Fix It"
related_products: ["dichen-fuser", "dichen-dc1a255", "dc1a686-fuser", "tracecore-dc505"]
sort_order: 4
reviewed_by: "TraceCoreLab team"
---

When a resolution or refresh rate is missing or wrong through a video fuser, the cause is almost always the mode list the graphics cards receive, a mismatch between PC 1 and PC 2, or a mode that is over the link's bandwidth. Fix it in this order: let the video fuser re-adapt, try its EDID modes, add the timing on the PC with CRU, set the same refresh rate on both PCs, then check the pixel clock.

## Why a mode goes missing

- **The mode list:** a graphics card only offers the modes in the EDID it receives, and through a video fuser that list is adapted, passed through from the monitor, or set by the model's EDID mode.
- **Mismatched sources:** most models need PC 1 and PC 2 at the same resolution and refresh rate, and Windows often falls back to 60 Hz after a reconnect.
- **Bandwidth:** the mode's pixel clock is over the link limit, or the cable is not rated for it.

## What EDID is (and what this guide does not change)

EDID (Extended Display Identification Data) is a small block of data a monitor sends over the cable. It lists supported resolutions, refresh rates, timings and colour formats, plus fields that name the maker, model and serial number.

This guide only deals with modes, timing and colour. The maker, model name and serial number fields stay exactly as the monitor reports them, and no step here writes EDID data to the monitor or the video fuser.

## Step 1: Use auto-adapt

1. Connect the monitor to the video fuser's output and turn the monitor on.
2. Make sure automatic EDID is active. On Dichen's 5th and 6th generation HDMI fusers it is the default, and a 2-second press on K1 switches between automatic and manual. If you switched it earlier, press K1 for 2 seconds again.
3. With the monitor on, disconnect and reconnect the video fuser's power so it reads the monitor again.
4. Press K1 briefly to show the mode each input receives (top line: host, bottom line: secondary).

The [D60 4K](/product/d60-4k-fuser) also adapts automatically, so a power cycle with the monitor on is the first step there too.

## Step 2: Try the preset modes

Use the vendor's built-in EDID options before anything on the PC:

| Model | EDID behaviour | What to try |
|---|---|---|
| [Dichen Fuser](/product/dichen-fuser) | Automatic adaptation | Step 1, then Step 3 if a mode is still missing |
| [DC1A255-H3](/product/dichen-dc1a255) | Native passthrough | Both PCs see the monitor's own list; a missing mode is usually over HDMI 2.0's limit |
| [DC1A686-D3ZC](/product/dc1a686-fuser) | Native passthrough; different resolutions per input (vendor-listed) | Set each PC on its own; check DSC for the top modes |
| [DC505](/product/tracecore-dc505) | Adaptive, Native and Custom modes | Start with Adaptive, then try Native for the monitor's own list |

The DC505's Custom mode is outside this guide; the manual in the box gives the key that switches modes.

## Step 3: Add a custom timing with CRU

[Custom Resolution Utility (CRU)](https://www.monitortests.com/forum/Thread-Custom-Resolution-Utility-CRU) adds a resolution or refresh rate as an override in the Windows registry of one PC. It writes nothing to the video fuser or the monitor, and it can be reset at any time.

1. Extract the CRU download to a folder and run CRU.exe.
2. Choose the display that the video fuser presents from the list at the top.
3. Under Detailed resolutions, click Add. Enter the resolution and refresh rate, pick a reduced-blanking timing option (CVT-RB2 where it is listed), and note the pixel clock CRU shows.
4. Click OK in both windows, then run restart64.exe (restart.exe on 32-bit Windows) to restart the graphics driver.
5. Select the new mode in Windows display settings. If the screen goes black, wait 15 seconds for Windows to revert, or run reset-all.exe and then restart64.exe.
6. Repeat on the other PC with identical values.

> [!NOTE]
> Keep the pixel clock under the link limit: about 600 MHz on HDMI 2.0 graphics cards (340 MHz on HDMI 1.x). Detailed resolutions in CRU are limited to 655.35 MHz. Leave CRU's other sections alone; changing only the detailed resolution keeps the override to timing.

For colour, use the graphics driver, not CRU. Set both PCs to 8-bit RGB, full range, in the NVIDIA or AMD control panel. YCbCr output can tint the picture pink or purple through a video fuser.

## Step 4: Set the refresh rate on both sources

1. **Windows 11:** Settings > System > Display > Advanced display. Choose the display, then pick the rate under "Choose a refresh rate".
2. **Windows 10:** Settings > System > Display > Advanced display settings. Choose the display, then pick the refresh rate.
3. Set PC 2 to exactly the same value as PC 1.
4. On PC 2, set display scaling to 100%. If PC 2 has several displays and duplicates them, use "Duplicate these displays" and check that the display shows as `1|2`.
5. Confirm both inputs with the model's info key, such as K1 on Dichen's 5th and 6th generation units.

## Still missing: check the pixel clock

| Link | Pixel clock at 8-bit RGB | Example that fits |
|---|---|---|
| HDMI 2.0 | about 600 MHz | 1080p 240 Hz, 1440p 144 Hz, 4K 60 Hz |
| DisplayPort 1.4 (HBR3) | about 1080 MHz | 1440p 240 Hz, 4K 120 Hz |
| HDMI 2.1 (FRL 48 Gbit/s) | about 1775 MHz | 1440p 360 Hz, 4K 160 Hz |

For example, 2560 × 1440 at 240 Hz needs about 1026 MHz. No HDMI 2.0 video fuser can carry it; it needs DisplayPort 1.4 or HDMI 2.1. Enter your monitor's exact mode in the [pixel clock calculator](/tools/pixel-clock-calculator), and read [pixel clock and video fuser bandwidth](/guides/pixel-clock-and-fuser-bandwidth) for the details. Check that every cable is rated for the link as well.

## Warning: never press the firmware-update button

> [!WARNING]
> None of these fixes needs the vendor's configuration tool or the Type-C configuration port. If you ever open that tool, never press its firmware-update button. An interrupted or wrong update can leave the video fuser unusable, and it does not fix resolution or refresh problems.

Cabling is in [HDMI video fuser setup](/guides/hdmi-video-fuser-setup) and [DisplayPort and HDMI 2.1 video fuser setup](/guides/displayport-and-hdmi-2-1-fuser-setup); black screens and flicker are in [video fuser troubleshooting](/guides/video-fuser-troubleshooting), and terms in the [glossary](/guides/glossary#video).

## FAQ

### What is EDID?

EDID is the data a monitor sends to list the resolutions, refresh rates, timings and colour formats it supports. A video fuser adapts it or passes it through, so both PCs get a list the monitor can show.

### Why does 144 Hz not show up through my video fuser?

Usually the video fuser has not re-read the monitor, or one PC is still at 60 Hz. Power-cycle the video fuser with the monitor on, check its EDID mode, then set 144 Hz on both PCs.

### Does CRU write anything to the monitor or the video fuser?

No. CRU stores overrides in the Windows registry of the PC it runs on, and reset-all.exe followed by restart64.exe removes them.

### Why do both PCs need the same refresh rate?

The video fuser combines the two pictures frame by frame, so most models need both inputs at the same resolution and refresh rate. The DC1A686-D3ZC is vendor-listed as accepting different resolutions with scaling.
