---
title: "MAKCU vs Ferrum USB Passthrough: Polling, Latency, Ports and Price"
description: "MAKCU vs Ferrum USB passthrough compared: 1000 Hz vs 8000 Hz polling, vendor-listed latency, mouse software support, ports, drivers and price, side by side."
section: "input"
kind: "comparison"
seo_title: "MAKCU vs Ferrum USB Passthrough: 1000 Hz vs 8000 Hz Compared"
related_products: ["makcu", "ferrum"]
sort_order: 4
reviewed_by: "TraceCoreLab team"
---

MAKCU and the Ferrum USB passthrough device both sit between a USB input device and a computer and pass it through, with plug-and-play passthrough on both. MAKCU is the low-cost choice for a mouse at up to 1000 Hz. Ferrum USB passthrough runs high-speed USB for up to 8000 Hz (vendor-listed), also takes a keyboard, and according to its maker keeps the mouse maker's software working.

## Short answer

- **Choose [MAKCU](/product/makcu)** for a mouse at 1000 Hz or below, at the lower price.
- **Choose [Ferrum USB passthrough](/product/ferrum)** for a mouse set above 1000 Hz, for a keyboard or a shared mouse and keyboard receiver, or if you want the mouse maker's software to keep working.

## Spec table

| | MAKCU | Ferrum USB passthrough |
|---|---|---|
| Passes through | USB mouse | Mouse, keyboard or both on one receiver |
| Polling rate | Up to 1000 Hz | Up to 8000 Hz (vendor-listed) |
| USB speed | Full speed, 12 Mbit/s | High speed, 480 Mbit/s |
| Added latency | Not listed | 0.6 ms at 1000 Hz, 0.14 ms at 8000 Hz (vendor-listed averages) |
| Mouse maker software | Not stated by the maker | Keeps working, per the maker |
| Ports | 3 × USB-A (computer, control, mouse) | USB-C (computer), USB-A (device), USB-C (control) |
| Control-port driver | WCH CH343 | Silicon Labs CP210x |
| Inside | 2 × Espressif ESP32-S3 | Not listed |
| Build | Board, no housing listed | Aluminium housing, bead-blasted finish |
| In the box | Board, 2 × USB-A to USB-A cable | Device, USB cables for the computer and control ports |
| Price | {{price:makcu}} | {{price:ferrum}} |
| Warranty | 3 months, replacement | 3 months, replacement |

## Polling rate

The polling ceiling follows from USB speed. MAKCU's ESP32-S3 microcontrollers have full-speed USB, which is polled at most once per 1 ms frame, so MAKCU stops at 1000 Hz. Ferrum USB passthrough uses high-speed USB, polled in 125 µs microframes, which allows up to 8000 Hz.

Neither device raises a mouse's rate. A 1000 Hz mouse runs at 1000 Hz through both, so Ferrum's higher ceiling only matters if your mouse is set to 2000, 4000 or 8000 Hz. Through MAKCU, such a mouse runs at no more than 1000 Hz, and community reports name some 8000 Hz mice and receivers that don't work through it at all. [USB polling rate explained](/guides/usb-polling-rate-1000hz-vs-8000hz) covers frame timing and how to measure your real rate.

## Passthrough latency (vendor-claimed)

The Ferrum maker lists an average added latency of 0.6 ms at 1000 Hz and 0.14 ms at 8000 Hz. MAKCU's maker publishes no added-latency figure. Both statements come from the makers, not from TraceCoreLab measurements, so they can't be compared directly: one device has a listed number and the other doesn't.

Measuring added latency takes hardware on both sides of the device, such as a USB protocol analyzer. A polling-rate checker shows the rate and how steady it is, not the added delay.

## Mouse maker software compatibility

According to its maker, Ferrum USB passthrough passes the whole USB device through, so the mouse maker's configuration software sees the mouse as if it were plugged in directly.

MAKCU's maker doesn't say whether configuration software works through it. If your mouse stores its settings on board, set them with the mouse plugged straight into the computer, then reconnect it through MAKCU.

## Build and ports

MAKCU is a board with three USB-A ports along one edge: left to the computer the mouse is used on, middle to the control port, right to the mouse. It ships with two USB-A to USB-A cables, and any standard USB 2.0 or USB 3.0 USB-A data cable works as a replacement.

Ferrum USB passthrough has an aluminium housing with a bead-blasted finish, offered in Gunmetal and Ember. Its ports are USB-C to the computer, USB-A for the mouse, keyboard or receiver, and a second USB-C for the control port.

On both, the computer the input device is used on needs no driver. Only the computer on the control port needs one: the WCH CH343 driver for MAKCU, or the Silicon Labs CP210x driver for Ferrum. Each setup guide shows how to install it and check that the device appears as a COM port in Device Manager.

## Price

MAKCU costs {{price:makcu}} and Ferrum USB passthrough costs {{price:ferrum}}. Both are tested in our lab before dispatch, carry a 3-month replacement warranty and ship worldwide.

## Which to choose

| If you need | Choose |
|---|---|
| Mouse passthrough at 1000 Hz, lowest cost | MAKCU |
| A mouse set to 2000, 4000 or 8000 Hz | Ferrum USB passthrough |
| Keyboard passthrough | Ferrum USB passthrough |
| One receiver shared by a mouse and keyboard | Ferrum USB passthrough |
| Mouse maker software that keeps working | Ferrum USB passthrough |
| A metal housing | Ferrum USB passthrough |

> [!TIP]
> Not sure what rate your mouse runs at? Check its software or measure it with a polling-rate checker before you choose. If it runs at 1000 Hz and you only need a mouse passed through, MAKCU covers it.

Setup steps are in the [MAKCU setup guide](/guides/makcu-setup) and the [Ferrum setup guide](/guides/ferrum-setup). Both devices are in [input devices](/shop/input).

## FAQ

### Is Ferrum USB passthrough faster than MAKCU?

It supports a higher polling rate: up to 8000 Hz (vendor-listed) against MAKCU's 1000 Hz. At 1000 Hz both pass the mouse at the same rate, and only Ferrum's maker lists an added-latency figure.

### Can MAKCU pass through a keyboard?

MAKCU is listed for mouse passthrough. For a keyboard, or one receiver shared by a mouse and keyboard, choose Ferrum USB passthrough and set its device type.

### Do MAKCU and Ferrum need drivers?

Not for passthrough. Only the computer connected to the control port needs a driver: WCH CH343 for MAKCU, Silicon Labs CP210x for Ferrum.

### Will an 8000 Hz mouse work with MAKCU?

It can run at no more than 1000 Hz through MAKCU, and some high-rate mice and receivers are reported not to work through it at all. Set the mouse to 1000 Hz first, or use Ferrum USB passthrough.
