---
title: "Video Fuser Troubleshooting: Black Screen, Pink Tint, Wrong Refresh"
description: "Fix a video fuser black screen, pink or green tint, wrong resolution or refresh rate, flicker or no signal, with a symptom table and step-by-step checks."
section: "fuser"
kind: "guide"
seo_title: "Video Fuser Black Screen, Pink Tint and Flicker Fixes"
related_products: ["dichen-fuser", "dichen-dc1a255", "d60-4k-fuser", "dc1a686-fuser", "godlike-4k-fuser", "tracecore-dc505"]
sort_order: 6
reviewed_by: "TraceCoreLab team"
---
Most video fuser problems come from four causes: a cable in the wrong port or not rated for the mode, two sources running different modes, a colour format other than 8-bit RGB, or a mode whose pixel clock is past the interface limit. Find your symptom in the table, then work through the matching section. Every fix here uses only Windows display settings, your graphics driver's control panel and the video fuser itself.

## Symptom table

| Symptom | Most likely cause | First thing to try |
|---|---|---|
| Black screen, no picture at all | Cable path, power or monitor input | Check each cable from source to video fuser to monitor, then power |
| Main picture shows, overlay missing | Overlay source has no signal or runs a different mode | Match resolution and refresh rate on both sources |
| One input LED off | No signal on that input | Reseat that cable, wake the source, power-cycle the video fuser |
| Wrong resolution or refresh rate | Sources on different modes, scaling not 100% | Match modes, set scale to 100%, re-run automatic EDID |
| Pink, purple or green tint | YCbCr output or 10-bit colour | Set 8-bit RGB, full range, HDR off on both sources |
| Flicker or dropouts | Cable not rated, mode at the bandwidth limit, variable refresh | Rated cable, one step lower refresh, variable refresh off |
| A vendor-listed mode never appears | Pixel clock over the limit, no DSC or FRL 48G | Check the mode with the [pixel clock calculator](/tools/pixel-clock-calculator) |

## Start with a baseline

1. Set both sources to 1920 × 1080 at 60 Hz. That mode is far inside every interface limit, so bandwidth drops out of the picture.
2. Use the cables that came with the video fuser, or cables rated for its interface.
3. On the overlay source, open a full-screen solid colour or test pattern so you can see the keying clearly.
4. Change one thing at a time, and note what you changed.

If the baseline works, look at the target mode, cable rating or colour settings. If it fails, start with the black screen checks.

## Black screen on the monitor

### Check the cable path

1. Main source: graphics card output to the video fuser's main input.
2. Overlay source: graphics card output to the video fuser's second input.
3. Video fuser output to the monitor.
4. Use ports on the graphics card itself, not the motherboard's video ports, which often stay blank when a graphics card is installed.

Port names differ by model. The [HDMI video fuser setup](/guides/hdmi-video-fuser-setup) and [DisplayPort and HDMI 2.1 video fuser setup](/guides/displayport-and-hdmi-2-1-fuser-setup) guides show the wiring for each model.

### Check power and the monitor input

1. Confirm the video fuser's power LED is lit.
2. Set the monitor's input to the port the video fuser is connected to.
3. Unplug the video fuser's power for 10 seconds with all video cables connected, then plug it back in so it reads the monitor's EDID again.

### Check the source modes

Both sources must run a mode the video fuser lists. Drop both to 1080p 60 Hz to test. On a laptop, press Windows + P and choose Duplicate or Second screen only so the picture actually goes to the external output.

![DICHEN DC1A255-H3 HDMI 2.0 video fuser, grey metal case with DCKJ logo, front power switch, four status LEDs and keys X1 to X4](/media/products/2026/11/08f0954eb86392112c53.webp)

## No signal on one input: reading the LEDs

Most models have a power LED plus status LEDs for the inputs and the fused output. Dichen's [video fuser guide](https://dichen.store/blogs/tutorial/dichen-fuser-guide) says that on its 5th and 6th generation HDMI fusers, an H1 or H2 LED that stays off means that input has no signal. LED names and colours vary between models, so check the manual for yours.

When one input LED stays off:

1. Reseat both ends of that source's cable, or swap in a cable you know works.
2. Wake the source and confirm it is not asleep or set to a different display.
3. Set that source to 1080p 60 Hz.
4. Power-cycle the video fuser with everything connected.

## Wrong resolution or refresh rate

The video fuser offers both sources the modes it reads from the monitor's EDID, the data block that lists the monitor's resolutions and refresh rates. Both sources then have to land on the same mode.

1. On the overlay source, open Settings, System, Display and set Scale to 100%.
2. If the overlay source drives more than one display, choose "Duplicate these displays" and check that the display box reads 1|2.
3. In Advanced display on each source, choose the same refresh rate, then compare the "Active signal mode" lines on both.
4. Let the video fuser read the monitor again: power-cycle it with the monitor connected. On Dichen's 5th and 6th generation HDMI fusers, holding K1 for 2 seconds switches automatic EDID adaptation on or off, so make sure it is on.
5. On the DC505, the Adaptive and Native EDID modes offer different mode lists; try the other one if a mode is missing.

[Fix wrong resolution or refresh rate](/guides/video-fuser-resolution-and-refresh) goes deeper into EDID modes and timing.

## Pink, purple or green tint

A colour cast almost always means one source is sending YCbCr or 10-bit colour instead of 8-bit RGB. Change these on both sources.

### NVIDIA

1. Open NVIDIA Control Panel, then Display, then Change resolution.
2. Select "Use NVIDIA color settings".
3. Set Output color format to RGB, Output color depth to 8 bpc and Output dynamic range to Full.

### AMD

1. Open AMD Software, then Settings, then Display.
2. Set Color Depth to 8 bpc.
3. Set Pixel Format to RGB 4:4:4 Pixel Format PC Standard (Full RGB).

### Windows

1. Turn off Use HDR in Settings, System, Display.
2. In Advanced display, confirm the bit depth reads 8-bit and the colour format reads RGB.

> [!TIP]
> A graphics driver update can reset these colour settings. If a tint comes back, check the colour format first.

## Flicker or dropouts

1. **Cable rating.** HDMI 2.0 modes need Premium High Speed cables (18 Gbit/s). HDMI 2.1 FRL 48G needs [Ultra High Speed HDMI cables](https://www.hdmi.org/spec21sub/ultrahighspeedcable). DisplayPort 1.4 needs VESA-certified cables rated for HBR3. Shorter cables help at high refresh rates.
2. **Bandwidth margin.** Modes near the limit, such as 4K 120 Hz over DisplayPort 1.4, leave almost no headroom. Drop one refresh step and check whether the flicker stops.
3. **Variable refresh.** Turn off G-SYNC, FreeSync or Adaptive-Sync on both sources while you test, so both run a fixed refresh rate.

### NVIDIA RTX 50 Series and newer laptops

The [DC505](/product/tracecore-dc505) is vendor-listed as flicker-free with NVIDIA RTX 50 Series graphics cards. The vendor notes that some RTX 5070 Ti or newer GPUs and some newer laptops need its "12G × 4" mode, which is HDMI 2.1 FRL at 48 Gbit/s over four 12 Gbit/s lanes. That mode only works when the graphics card, the DC505 and the monitor all support FRL 48G.

## Mixed HDMI and DisplayPort chains

For the earlier DC500 family, the published guidance is all HDMI or all DisplayPort, never a mix. On dual-interface models such as the DC505, keep both sources and the monitor on one interface where you can. A DisplayPort to HDMI adapter limits the link to its own rating.

## A listed mode does not work

1. **Pixel clock.** Check the mode against the interface limit in [pixel clock and video fuser bandwidth](/guides/pixel-clock-and-fuser-bandwidth).
2. **DSC.** The top DisplayPort modes of the [DC1A686-D3ZC](/product/dc1a686-fuser) and the DC505 need DSC on both graphics cards and the monitor.
3. **FRL 48G.** The DC505's HDMI 2.1 modes need FRL at 48 Gbit/s on every device. A port sold as HDMI 2.1 may run a lower FRL rate.
4. **Overlay source graphics.** The [GODLIKE 4K Pro](/product/godlike-4k-fuser) lists an AMD RX 470, NVIDIA RTX 2060 or Radeon 780M or newer. The [D60 4K](/product/d60-4k-fuser) lists an HDMI 2.1 output on the overlay source for high-refresh modes.

## Resets by model

Reset steps differ between models. Dichen's guide for its 5th and 6th generation HDMI fusers says K3 resets the keying strength. For the [Dichen Fuser](/product/dichen-fuser), [DC1A255-H3](/product/dichen-dc1a255), D60 4K, DC1A686-D3ZC, DC505 and GODLIKE 4K Pro, take the reset steps from the model's manual or ask [support](/support) before pressing keys.

> [!WARNING]
> Keys do different things on each model. Holding a key "to see what happens" can switch EDID or keying modes and make a fault harder to trace.

## Before a warranty claim

1. Repeat the 1080p 60 Hz baseline with known-good cables.
2. Swap the two sources between the inputs to see whether the fault follows the source or the input.
3. Photograph the LEDs and note the model, both graphics cards, the monitor and the mode.
4. Contact [support](/support) with those notes. TraceCoreLab covers video fusers with a 3-month replacement warranty for hardware faults; see the [warranty terms](/legal/warranty).

## FAQ

### Why does my video fuser show a black screen?

Usually a cable in the wrong port, the monitor on the wrong input, or a source running a mode the video fuser does not list. Test both sources at 1080p 60 Hz with known-good cables first.

### Why does the picture through my HDMI fuser look pink?

One source is sending YCbCr or 10-bit colour. Set both sources to 8-bit RGB with full range and turn HDR off.

### Do both sources need the same resolution and refresh rate?

On most models, yes. The DC1A686-D3ZC is vendor-listed as accepting different resolutions on each source.

### Which cable do I need for 4K 120 Hz?

Over DisplayPort 1.4, a VESA-certified cable rated for HBR3. Over HDMI 2.1, an Ultra High Speed HDMI cable.

### Does power-cycling the video fuser help?

Often. The video fuser reads the monitor's EDID again and renegotiates both inputs. Keep every cable connected while you do it.
