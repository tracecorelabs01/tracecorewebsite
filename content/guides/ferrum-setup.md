---
title: "Ferrum USB Passthrough Setup: Wiring, CP210x Driver and Device Type"
description: "Set up the Ferrum USB passthrough device: port wiring, the Silicon Labs CP210x driver on the control-port computer, device type and 8000 Hz polling checks."
section: "input"
kind: "guide"
seo_title: "Ferrum USB Passthrough Setup: Wiring, CP210x Driver, Polling"
related_products: ["ferrum"]
sort_order: 2
reviewed_by: "TraceCoreLab team"
---

The Ferrum USB passthrough device sits between a mouse or keyboard and your computer and passes it through over high-speed USB, at up to 8000 Hz (vendor-listed). Passthrough is plug-and-play. The only driver is the Silicon Labs CP210x USB-to-UART driver on the computer connected to Ferrum's control port, which is also where the device type is set.

![Ferrum USB passthrough device in the gunmetal finish, angled on a dark red background](https://tracecorelab.com/products/cards/ferrum.webp)

## What you need

- A [Ferrum USB passthrough device](/product/ferrum) and its USB cables for the computer and control ports.
- A USB mouse, a keyboard, or a wireless receiver.
- The computer the mouse or keyboard is used on, with a free USB port on the motherboard's rear panel.
- A computer for the control port, where the CP210x driver goes. The checks below use Windows Device Manager.

## What Ferrum USB passthrough does

Ferrum runs on high-speed USB (480 Mbit/s), which is polled in 125 µs microframes. That is what allows polling rates up to 8000 Hz, where full-speed USB stops at 1000 Hz. According to the maker, the whole USB device is passed through, so the mouse maker's own software keeps working. The maker lists an average added latency of 0.6 ms at 1000 Hz and 0.14 ms at 8000 Hz. These are vendor-listed figures, not TraceCoreLab measurements.

## Step 1: Passthrough wiring

With the USB ports facing you:

| Port | Connects to | Driver needed |
|---|---|---|
| Left USB-C | The computer the mouse or keyboard is used on | None |
| Middle USB-A | Your mouse, keyboard or wireless receiver | None |
| Right USB-C (control port) | The control-port computer | Silicon Labs CP210x |

1. Plug the mouse, keyboard or receiver into the middle USB-A port.
2. Connect the left USB-C port to a rear motherboard USB port on the computer it is used on. Avoid front-panel case ports.
3. The mouse or keyboard should work straight away, with no driver.

## Step 2: Install the CP210x driver on the control-port computer

1. Connect Ferrum's right USB-C port (the control port) to the control-port computer.
2. Download the driver from the [Silicon Labs CP210x USB to UART Bridge VCP drivers page](https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers). On Windows 10 or 11, take the CP210x Universal Windows Driver.
3. Extract the zip, right-click **silabser.inf** and choose **Install**. On Windows 11, choose **Show more options** first.
4. Unplug the control cable and plug it back in.

> [!WARNING]
> Download the driver from Silicon Labs only. Driver files passed around in chat servers or on mirrors are unchecked.

## Step 3: Check that Ferrum appears

1. On the control-port computer, right-click **Start** and open **Device Manager**.
2. Expand **Ports (COM & LPT)**.
3. Look for **Silicon Labs CP210x USB to UART Bridge (COMn)**, where n is the port number.

If an entry with a warning icon shows under **Other devices** instead, the driver is not installed. Repeat Step 2.

## Step 4: Choose the device type

The device type tells Ferrum what is plugged into its USB-A port. Set it from the control-port computer in the Ferrum configuration app, on the **Boards** tab. If the app opens in another language, the language selector is in the bottom-left corner.

| Device type | Choose it for |
|---|---|
| Mouse (default) | A wired mouse or a mouse-only receiver |
| Keyboard | A wired keyboard or a keyboard-only receiver |
| Both | One wireless receiver shared by a mouse and a keyboard |

> [!NOTE]
> We don't link a download for the configuration app because we have not confirmed an official public source for it. [Ask us](/support) or on Discord for the current version.

## Step 5: Check passthrough and polling

- The mouse or keyboard should behave exactly as it does when plugged in directly, and its maker's software should still find it.
- Ferrum passes through the rate the mouse is set to. It does not raise it, so set 2000, 4000 or 8000 Hz in the mouse's own software.
- Measure the result with a polling-rate checker. [USB polling rate explained](/guides/usb-polling-rate-1000hz-vs-8000hz) shows how to measure it.

## Troubleshooting passthrough

| Symptom | What to try |
|---|---|
| Mouse or keyboard doesn't respond | Check the device type matches what is plugged in, then replug it into the middle USB-A port |
| Shared receiver: only the mouse or the keyboard works | Set the device type to Both |
| Ferrum missing from Ports (COM & LPT) | Reinstall the CP210x driver, replug the control cable, then try another cable and port |
| The app shows "No Boards Connected" | Check the control cable and the CP210x entry in Device Manager |
| Polling stays at 1000 Hz | Check the mouse is set above 1000 Hz and the left cable is in a rear motherboard port |

Still stuck? [Contact support](/support) with your order number. Every Ferrum is tested in our lab before dispatch and carries a 3-month [replacement warranty](/legal/warranty). Browse all [input devices](/shop/input), or read [MAKCU vs Ferrum](/guides/makcu-vs-ferrum).

## FAQ

### Does Ferrum USB passthrough need drivers?

Not for passthrough: the computer the mouse or keyboard is used on needs nothing installed. Only the computer on the control port needs the Silicon Labs CP210x USB-to-UART driver.

### Will Ferrum make a 1000 Hz mouse poll at 8000 Hz?

No. Ferrum passes through the rate the mouse runs at, up to 8000 Hz (vendor-listed). Reaching 8000 Hz needs a mouse that supports it.

### Does my mouse software still work through Ferrum?

According to the maker, yes: Ferrum passes the whole USB device through, so the mouse maker's configuration software sees the mouse as if it were plugged in directly.

### Can I use a wireless receiver?

Yes. Plug the receiver into the middle USB-A port. If it serves both a mouse and a keyboard, set the device type to Both.
