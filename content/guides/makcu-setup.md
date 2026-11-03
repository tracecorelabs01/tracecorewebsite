---
title: "MAKCU Setup Guide: Wiring, CH343 Driver and Mouse Passthrough"
description: "Set up MAKCU step by step: wire its three USB-A ports, install the WCH CH343 driver, check the COM port and fix mouse passthrough problems at up to 1000 Hz."
section: "input"
kind: "guide"
seo_title: "MAKCU Setup: Wiring, CH343 Driver and Passthrough Checks"
related_products: ["makcu"]
sort_order: 1
reviewed_by: "TraceCoreLab team"
---

MAKCU is a USB mouse passthrough board: the mouse plugs into MAKCU, and MAKCU passes it through to your computer at up to 1000 Hz. Passthrough is plug-and-play, and the only driver is the WCH CH343 driver on the computer connected to the middle (control) port.

![MAKCU USB mouse passthrough board with three USB-A ports along one edge](https://tracecorelab.com/products/cards/makcu.webp)

## What you need

- A [MAKCU USB passthrough board](/product/makcu). It ships ready to use, so there is nothing to load onto it before setup.
- The two USB-A to USB-A cables from the box. A standard USB 2.0 or USB 3.0 USB-A to USB-A data cable works as a replacement.
- A USB mouse, wired or with its wireless receiver.
- The computer the mouse will be used on.
- A Windows 10 or 11 computer for the control port, where the CH343 driver goes.

## The three ports

MAKCU is built on two Espressif ESP32-S3 microcontrollers whose USB runs at full speed (12 Mbit/s), so it passes a mouse through at up to 1000 Hz. With the three USB-A ports facing you:

| Port | Connects to | Driver needed |
|---|---|---|
| Left | The computer the mouse is used on | None |
| Middle (control port) | The control-port computer | WCH CH343 |
| Right | Your mouse or its wireless receiver | None |

## Step 1: Connect the mouse

Plug the mouse, or its wireless receiver, into the right-hand port.

> [!TIP]
> If your mouse can poll above 1000 Hz, set it to 1000 Hz in its own software first, with it plugged straight into the computer. That rules out one cause if it doesn't respond through MAKCU.

## Step 2: Connect the computer the mouse is used on

Connect a cable from MAKCU's left port to the computer the mouse is used on. The mouse should now work as it does when plugged in directly, with no driver installed.

> [!NOTE]
> The MAKCU documentation notes that after this computer is switched on, MAKCU needs reconnecting before the mouse responds. Unplug the left cable and plug it back in.

## Step 3: Install the CH343 driver on the control-port computer

1. Connect the second cable from MAKCU's middle port to the control-port computer.
2. Download the CH343 serial driver (CH343SER) from [WCH's official CH343SER download page](https://www.wch-ic.com/downloads/CH343SER_EXE.html).
3. Run the installer and choose **Install**.
4. Unplug the middle cable and plug it back in.

> [!WARNING]
> Get the driver from WCH only. Driver zips shared in chat servers or on mirrors are unchecked.

## Step 4: Check that MAKCU appears as a COM port

1. On the control-port computer, right-click **Start** and open **Device Manager**.
2. Expand **Ports (COM & LPT)**.
3. Look for **USB-Enhanced-SERIAL CH343 (COMn)**, where n is the port number.

If MAKCU shows under **Other devices** with a warning icon instead, the driver is not installed. Repeat Step 3.

### Set a COM number below 10

The MAKCU documentation recommends a COM number below 10:

1. Right-click the CH343 entry and choose **Properties**.
2. Open **Port Settings**, then **Advanced**.
3. Under **COM Port Number**, pick a free number from COM1 to COM9 and press **OK**.
4. Restart MAKCU by unplugging the left cable and plugging it back in.

## Step 5: Check passthrough

Check pointer movement, every button and the scroll wheel. To confirm the rate, run a polling-rate checker through MAKCU: expect up to 1000 Hz. [USB polling rate explained](/guides/usb-polling-rate-1000hz-vs-8000hz) shows how to measure it.

## Mouse compatibility

- **Polling rate.** A mouse set to 2000, 4000 or 8000 Hz runs at no more than 1000 Hz through MAKCU.
- **High-rate mice and receivers.** Community reports name some 8000 Hz mice and some wireless receivers that don't work through MAKCU. We have not tested a full list, so [ask us](/support) before buying a mouse for it.
- **Mouse settings.** The maker doesn't say whether mouse configuration software works through MAKCU. If your mouse stores settings on board, set them with it plugged in directly, then reconnect it through MAKCU.
- **Keyboards and higher rates.** For a keyboard or more than 1000 Hz, see the [Ferrum USB passthrough device](/product/ferrum) and [MAKCU vs Ferrum](/guides/makcu-vs-ferrum).

## Troubleshooting passthrough

| Symptom | What to try |
|---|---|
| Mouse stops working after the computer starts | Unplug MAKCU's left cable and plug it back in |
| Mouse doesn't work at all | Check each cable is in the right port, try another USB port on the computer, then another mouse |
| High-rate mouse doesn't respond | Set it to 1000 Hz with it plugged in directly, then reconnect |
| MAKCU missing from Ports (COM & LPT) | Reinstall the CH343 driver, then try another cable (some are charge-only) |
| A CH340 port is listed too | Pick USB-Enhanced-SERIAL CH343, not USB-SERIAL CH340 |

The maker's notes are in the [MAKCU documentation](https://makcu.gitbook.io/makcu). Still stuck? [Contact support](/support) with your order number. Every MAKCU is tested in our lab before dispatch and carries a 3-month [replacement warranty](/legal/warranty). Browse all [input devices](/shop/input).

## FAQ

### Does MAKCU need a driver?

Not for passthrough: the computer the mouse is used on needs nothing installed. The computer on the middle (control) port needs the WCH CH343 serial driver.

### Can MAKCU pass through more than 1000 Hz?

No. Its full-speed USB is polled at most once per millisecond, so 1000 Hz is the ceiling. The [Ferrum USB passthrough device](/product/ferrum) runs over high-speed USB at up to 8000 Hz (vendor-listed).

### Why does my mouse stop working after I restart the computer?

The MAKCU documentation lists this as known behaviour. Unplug MAKCU's left cable and plug it back in after the computer has started.

### Does MAKCU work with a keyboard?

MAKCU is listed for mouse passthrough only. For a keyboard, or one wireless receiver shared by a mouse and keyboard, the [Ferrum setup guide](/guides/ferrum-setup) covers the Ferrum USB passthrough device.
