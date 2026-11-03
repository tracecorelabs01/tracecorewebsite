---
title: "USB Polling Rate Explained: 1000 Hz vs 8000 Hz Through Passthrough"
description: "What USB polling rate means, why full-speed USB stops at 1000 Hz while high-speed reaches 8000 Hz, and how to measure polling through a passthrough device."
section: "input"
kind: "guide"
seo_title: "8000 Hz Polling Rate Explained: 1000 Hz vs 8000 Hz on USB"
related_products: ["makcu", "ferrum"]
sort_order: 3
reviewed_by: "TraceCoreLab team"
---

Polling rate is how many times per second a computer collects new data from a USB mouse or keyboard: 1000 Hz is a report every 1 ms, 8000 Hz a report every 0.125 ms. The ceiling comes from USB speed. Full-speed USB is polled at most once per 1 ms frame (1000 Hz) and high-speed USB once per 125 µs microframe (8000 Hz), so a USB passthrough device can never pass through more than its own USB speed allows.

## What polling rate is

A USB mouse doesn't send data whenever it likes. The computer's USB host controller asks it for a report at a fixed interval, and the mouse answers with whatever changed since the last report: movement, button presses, scrolling. The polling rate is how often that happens.

| Polling rate | Time between reports |
|---|---|
| 125 Hz | 8 ms |
| 500 Hz | 2 ms |
| 1000 Hz | 1 ms |
| 2000 Hz | 0.5 ms |
| 4000 Hz | 0.25 ms |
| 8000 Hz | 0.125 ms |

The interval is the longest a change can wait for its next poll. At 1000 Hz a movement waits up to 1 ms; at 8000 Hz, up to 0.125 ms. The sensor, the mouse's own processing and the software on the computer add their own time on top.

## USB speed classes and frame timing

A mouse tells the computer how often it wants to be polled, and the USB speed it connects at sets the shortest interval allowed. USB 2.0 counts time in frames:

| USB speed | Signalling rate | Time unit | Shortest polling interval | Highest polling rate |
|---|---|---|---|---|
| Full speed | 12 Mbit/s | 1 ms frame | 1 ms | 1000 Hz |
| High speed | 480 Mbit/s | 125 µs microframe | 125 µs | 8000 Hz |

A full-speed device can be polled at most once per frame, which is 1000 Hz. High-speed USB divides each frame into eight microframes, so a high-speed device can be polled up to eight times per millisecond. A mouse rated above 1000 Hz therefore has to connect at high speed. Low-speed devices (1.5 Mbit/s), mostly older mice and keyboards, are polled far less often.

USB 3 ports carry high-speed USB 2.0 alongside their faster lanes, so an 8000 Hz mouse runs at 8000 Hz in a USB 2.0 port or a USB 3 port.

## Why some passthrough devices cap at 1000 Hz

A USB passthrough device sits between the mouse and the computer and talks USB on both sides: it is the host for the mouse, and it presents the mouse to the computer. Both links run at the speed its own USB hardware supports, and the slower link sets the ceiling.

- **[MAKCU](/product/makcu)** is built on Espressif ESP32-S3 microcontrollers, and Espressif's [ESP32-S3 datasheet](https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf) lists its USB OTG interface as full speed, 12 Mbit/s. Full speed means 1 ms frames, so MAKCU tops out at 1000 Hz however fast the mouse is.
- **[Ferrum USB passthrough](/product/ferrum)** runs high-speed USB (480 Mbit/s) and polls in 125 µs microframes, for up to 8000 Hz (vendor-listed).

A 2000, 4000 or 8000 Hz mouse behind a full-speed passthrough device runs at 1000 Hz at most. Community reports also name some high-rate mice and receivers that don't work through MAKCU at all; the [MAKCU setup guide](/guides/makcu-setup) covers mouse compatibility. A passthrough device never raises a mouse's rate: a 1000 Hz mouse stays at 1000 Hz through either device.

## Passthrough latency: how to measure it

Added latency is the extra time a report takes to reach the computer through a passthrough device, compared with the same mouse plugged in directly. The figures involved are fractions of a millisecond, too small to judge by feel.

Software on the computer can measure the polling rate and how steady the report interval is (jitter). It cannot measure the added delay itself, because the computer only sees when a report arrives, not when the mouse produced it. That takes hardware on both sides of the passthrough device: a USB protocol analyzer that timestamps each report on the way in and on the way out.

> [!NOTE]
> For a fair comparison, keep everything else fixed:
> 1. Use the same mouse, settings, cable and computer port for every run.
> 2. Measure the mouse plugged in directly first, then through the passthrough device.
> 3. Capture thousands of reports per run and repeat the run several times.
> 4. Report the spread as well as the average, with the equipment, polling rate and sample size.

## Vendor-claimed figures

| | MAKCU | Ferrum USB passthrough |
|---|---|---|
| USB speed | Full speed, 12 Mbit/s | High speed, 480 Mbit/s |
| Highest polling rate | 1000 Hz | 8000 Hz (vendor-listed) |
| Added latency at 1000 Hz | Not listed | 0.6 ms average (vendor-listed) |
| Added latency at 8000 Hz | Not supported | 0.14 ms average (vendor-listed) |

These are the makers' figures, not TraceCoreLab measurements. For scale, reports at 1000 Hz are 1 ms apart, so a 0.6 ms average fits within one report interval. At 8000 Hz, 0.14 ms is a little more than one 125 µs microframe.

## CPU cost at 8000 Hz

Every report is work for the computer: the USB host controller, its driver and every program that reads the input all handle it. At 8000 Hz there are eight times as many reports per second as at 1000 Hz. Current desktop processors usually absorb that, but on an older or heavily loaded computer it can show up as higher CPU use or uneven pointer movement in some programs. If you see either, step down to 4000 or 2000 Hz in the mouse's software and compare.

A higher rate also doesn't make the sensor faster. It shortens the wait between reports, nothing more.

## How to check your real polling rate

1. Set the rate in the mouse's own software, with the mouse plugged straight into the computer.
2. Open a polling-rate checker. Above 1000 Hz, a desktop checker that reads raw mouse input is more reliable than a browser-based one, because browsers can merge mouse events before a page sees them.
3. Move the mouse in fast, continuous circles for a few seconds. Slow movement under-reads, because the mouse only sends a report when something has changed.
4. Read the average rate and the spread. A steady reading close to the set rate is the goal.
5. Connect the mouse through the passthrough device and repeat. Through MAKCU, expect up to 1000 Hz. Through Ferrum USB passthrough, expect the rate the mouse is set to, up to 8000 Hz (vendor-listed).

> [!TIP]
> Use the same rear motherboard USB port on the computer for both measurements, so the port isn't a variable.

Setup steps for each device are in the [MAKCU setup guide](/guides/makcu-setup) and the [Ferrum setup guide](/guides/ferrum-setup). To weigh the two side by side, read [MAKCU vs Ferrum](/guides/makcu-vs-ferrum) or browse [input devices](/shop/input).

## FAQ

### Is 8000 Hz better than 1000 Hz?

It cuts the time between reports from 1 ms to 0.125 ms, at the cost of eight times as many reports for the computer to handle. Whether the difference matters depends on the mouse, the computer and the software, so measure both settings.

### Does a USB passthrough device add latency?

Any device in the path adds some time. The Ferrum maker lists averages of 0.6 ms at 1000 Hz and 0.14 ms at 8000 Hz; MAKCU's maker lists no figure. Measuring it takes a USB protocol analyzer, not software on the computer.

### Why does my 8000 Hz mouse read 1000 Hz?

Check three things: the rate set in the mouse's software, whether it is connected through a full-speed device such as MAKCU, and whether the checker runs in a browser, which can merge events.

### What is the USB polling interval?

It is the time between two polls of a device. Full-speed USB counts it in 1 ms frames and high-speed USB in 125 µs microframes, which gives the 1000 Hz and 8000 Hz ceilings.

### Can a passthrough device raise my mouse's polling rate?

No. It can only pass through the rate the mouse already runs at, up to its own ceiling.
