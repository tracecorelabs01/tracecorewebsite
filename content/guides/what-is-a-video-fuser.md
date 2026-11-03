---
title: "What Is a Video Fuser? Keying Two Video Sources on One Display"
description: "A video fuser keys graphics from a second PC over the main picture on one monitor. Learn how keying, EDID and HDMI or DisplayPort bandwidth work."
section: "fuser"
kind: "guide"
seo_title: "What Is a Video Fuser? Keying, EDID and Interfaces Explained"
related_products: ["dichen-fuser", "d60-4k-fuser", "dc1a686-fuser", "tracecore-dc505"]
sort_order: 1
reviewed_by: "TraceCoreLab team"
---

A video fuser is a hardware box that takes two video sources and shows them on one display: the main source fills the screen, and the graphics from the second source are keyed over it so their background disappears. It is used for stream graphics, presentation overlays, picture-in-picture windows and digital signage, and some models also capture the combined picture. It is not the printer fuser found in laser printers.

## Short answer

- **What it does:** combines two video inputs into one output by colour keying, in hardware, with no overlay software on the main PC.
- **Ports:** two inputs (main PC and second PC) and one output to the monitor, over HDMI or DisplayPort.
- **What it needs:** both sources at a mode the monitor supports, usually the same resolution and refresh rate, and cables rated for that bandwidth.

## How a video fuser works

A video fuser receives both video signals at once and builds one output picture from them. Where the second source shows the key colour, the main picture shows through; everywhere else, the second source is drawn on top. The combined picture goes to the monitor at the mode both sources share.

### Program feed and overlay source

Video production calls the main picture the program feed. Here, PC 1 (the main PC) provides it: slides, a video, a camera feed or a desktop. PC 2 (the second PC) is the overlay source. It renders only the graphics you want on top, such as a lower-third, a clock, a chat panel or a logo, on a plain background in the key colour. PC 1 runs no overlay software, and the graphics can change on PC 2 without touching the program feed.

### Keying strength

Anti-aliased text and soft edges contain pixels close to the key colour without matching it, which can leave a thin halo. Video fusers give you a keying strength control for this. On Dichen's 5th and 6th generation HDMI fusers, the K2 key sets the "cutout" strength in 21 levels from 0 to 20 (default 0), and K3 returns it to the default. Raise it one step at a time until the halo disappears, and stop before the graphics start to break up.

> [!TIP]
> The vendor sets which colour a model treats as transparent. Check your model's manual and build the overlay background in exactly that colour, with no gradient, shadow or texture.

### EDID and mode matching

Every monitor reports what it can display through EDID (Extended Display Identification Data), which the graphics card reads when a cable is connected. A video fuser sits between two graphics cards and one monitor, so it has to offer both sources modes the monitor can show:

- **Automatic adaptation:** the video fuser reads the monitor and offers both sources a matching set of modes. This is the default on Dichen's 5th and 6th generation HDMI fusers.
- **Native passthrough:** the monitor's own EDID goes to both sources (DC1A255-H3, DC1A686-D3ZC).
- **Selectable EDID modes:** the DC505 offers Adaptive, Native and Custom modes.

Most models need PC 1 and PC 2 at the same resolution and refresh rate. The DC1A686-D3ZC is vendor-listed as accepting different resolutions on its two inputs, with scaling. If a mode is missing, see the [resolution and refresh guide](/guides/video-fuser-resolution-and-refresh).

## Interfaces: HDMI 2.0, HDMI 2.1 and DisplayPort 1.4

The interface decides how much video a video fuser can carry. The useful measure is pixel clock: horizontal total × vertical total × refresh rate. At 8-bit RGB the data rate is about pixel clock × 24.

| Interface | Video data | Pixel clock at 8-bit RGB | Fits uncompressed (examples) |
|---|---|---|---|
| HDMI 2.0 | 14.4 Gbit/s | about 600 MHz | 1080p 240 Hz, 1440p 144 Hz, 4K 60 Hz |
| DisplayPort 1.4 (HBR3) | 25.92 Gbit/s | about 1080 MHz | 1080p 360 Hz, 1440p 240 Hz, 4K 120 Hz |
| HDMI 2.1 (FRL 48 Gbit/s) | about 42.6 Gbit/s | about 1775 MHz | 1080p 500 Hz, 1440p 360 Hz, 4K 160 Hz |

These use approximate CVT reduced-blanking timings; check your monitor's exact mode with the [pixel clock calculator](/tools/pixel-clock-calculator) or the [pixel clock and bandwidth guide](/guides/pixel-clock-and-fuser-bandwidth).

DisplayPort 1.4 added Display Stream Compression ([DSC 1.2, per VESA](https://vesa.org/featured-articles/vesa-publishes-displayport-standard-version-1-4/)), which compresses up to 3:1. Vendor-listed modes above the uncompressed limit, such as 4K 144 Hz over DP 1.4, only work when the graphics cards, the video fuser and the monitor all support DSC. HDMI 2.1 features are optional, so an HDMI 2.1 label does not guarantee FRL at 48 Gbit/s.

> [!NOTE]
> 10-bit colour multiplies the data rate by 1.25. 4K 120 Hz at 10-bit needs about 32.3 Gbit/s, over the DP 1.4 limit without DSC.

## Capture-enabled models

![DICHEN DC505 video fuser in a white metal case with a round top vent, K1 to K4 keys, status LEDs and a USB-C port labelled Collect](/media/products/2026/10/62da4dd63cb143a7608a.webp)

- **[DC505](/product/tracecore-dc505):** 1080p 60 Hz video with audio, from one input directly or from the fused picture, while the overlay keeps running (vendor-listed).
- **[DC1A686-D3ZC](/product/dc1a686-fuser):** 1080p 60 Hz capture with audio for live streaming (vendor-listed).

Capture tops out at 1080p 60 Hz, which suits streaming platforms and recordings. The capture connection and recording steps are model-specific, so follow the manual in the box.

## Video fuser vs KVM switch vs capture card vs picture-in-picture

| Device | What it does with two sources | Both visible at once | Records or streams |
|---|---|---|---|
| Video fuser | Keys the second source's graphics over the main picture | Yes, layered | Only models with capture |
| KVM switch | Switches the monitor between computers | No, one at a time | No |
| Capture card | Brings one video signal into a computer | No | Yes, through software |
| Monitor picture-in-picture | Shows a second input in a box or split screen | Yes, boxed | No |

A KVM switch or picture-in-picture shows each source as a whole rectangle. A video fuser cuts the second source's background away, so only its graphics remain, anywhere on the screen at the full output resolution.

## Common uses

- **Stream graphics:** alerts, lower-thirds, a chat panel or a sponsor logo rendered on the second PC, so the main PC runs no overlay software.
- **Presentation and teleprompter overlays:** speaker notes, a countdown timer or a script keyed over the slides on a confidence monitor facing the presenter.
- **Picture-in-picture:** a camera or preview window in a corner of the main picture.
- **Digital signage:** a ticker, a clock or an announcement banner over a looping video.
- **Capture:** recording or streaming the fused picture on the DC505 and DC1A686-D3ZC.

## How to choose

1. Start from the monitor: its input (HDMI or DisplayPort) and the mode you plan to run.
2. Check that mode's pixel clock against the limits above. If it needs DSC, every device must support DSC; otherwise look at HDMI 2.1.
3. Check that the second PC's graphics output reaches the same mode.
4. Decide whether you need capture or different resolutions per input.

| Model | Interface | Top vendor-listed modes | Capture | Price |
|---|---|---|---|---|
| [Dichen Fuser](/product/dichen-fuser) | HDMI | 1080p 240 Hz, 4K 60 Hz | Not listed | {{price:dichen-fuser}} |
| [DC1A255-H3](/product/dichen-dc1a255) | 3 × HDMI 2.0 | 1080p 240 Hz, 1440p 144 Hz | Not listed | {{price:dichen-dc1a255}} |
| [D60 4K](/product/d60-4k-fuser) | DP 1.4 | 4K 120 Hz, 1080p 360 Hz | Not listed | {{price:d60-4k-fuser}} |
| [GODLIKE 4K Pro](/product/godlike-4k-fuser) | DisplayPort | 4K 120 Hz, 1080p 360 Hz | Not listed | {{price:godlike-4k-fuser}} |
| [DC1A686-D3ZC](/product/dc1a686-fuser) | 3 × DP 1.4 | 4K 164 Hz, 1080p 639 Hz (need DSC) | 1080p 60 Hz | {{price:dc1a686-fuser}} |
| [DC505](/product/tracecore-dc505) | HDMI 2.1 or DP 1.4 | 4K 160 Hz, 1080p 550 Hz (HDMI 2.1) | 1080p 60 Hz | {{price:tracecore-dc505}} |

Compare more in the [video fuser shop](/shop/fuser) or [choosing a video fuser](/guides/choosing-a-video-fuser). Then follow [HDMI video fuser setup](/guides/hdmi-video-fuser-setup) or [DisplayPort and HDMI 2.1 video fuser setup](/guides/displayport-and-hdmi-2-1-fuser-setup). Terms are defined in the [glossary](/guides/glossary#video).

## FAQ

### Is a video fuser the same as a capture card?

No. A capture card brings a video signal into a computer, while a video fuser combines two sources on a monitor. The DC505 and DC1A686-D3ZC list built-in 1080p 60 Hz capture, so they do both.

### Do both PCs need the same resolution and refresh rate?

On most models, yes. The DC1A686-D3ZC is vendor-listed as accepting different resolutions on its two inputs, with scaling.

### Should I choose an HDMI or a DisplayPort video fuser?

Match the monitor's input and the mode you need. HDMI 2.0 covers 1080p 240 Hz and 4K 60 Hz, DisplayPort 1.4 reaches 4K 120 Hz uncompressed, and HDMI 2.1 at FRL 48 Gbit/s goes higher if both graphics cards and the monitor support it.

### Is a video fuser related to a printer fuser?

No. A printer fuser is the heated assembly in a laser printer that bonds toner to paper. A video fuser combines two picture sources on one display.
