// The /about page (Markdown). Tokens like {{supportEmail}} are filled from Settings when it renders.
// Facts to add once the owner supplies them: legal name and country, address, founding year, who runs the store,
// ship-from country, what the lab test checks, support hours.
export const aboutPage = `TraceCoreLab is an online store for FPGA-based PCIe DMA cards, video fusers, USB input passthrough devices and accessories. Alongside the hardware, we publish setup guides for each product family and help customers on Discord and by email.

> The TraceCoreLab store sells hardware only: FPGA-based PCIe DMA cards, video fusers, USB input passthrough devices and accessories. No game cheats, cheat software or anti-cheat bypass tools are sold on this website, and our guides cover hardware setup, development, research and production use only.

## What we sell

### PCIe DMA cards

FPGA DMA cards built on Xilinx Artix-7 chips, including the TraceCore 75T and the TraceCore 100T Pro. They are PCILeech-compatible PCIe cards for FPGA and PCIe development, memory forensics with MemProcFS, incident response, security research and hardware debugging. Use a DMA card only on computers you own or are authorized to examine. Start with [What is a PCIe DMA card?](/guides/what-is-a-pcie-dma-card) or [shop DMA cards](/shop/dma).

### Video fusers

HDMI and DisplayPort video fusers show two video sources on one display by keying an overlay source over the main picture. They are used for stream overlays, presentation graphics, picture-in-picture windows, capture and digital signage. Read [What is a video fuser?](/guides/what-is-a-video-fuser) or [shop video fusers](/shop/fuser).

### USB input passthrough devices

MAKCU and the Ferrum USB passthrough device sit inline between a USB mouse or keyboard and a computer and pass the input through: MAKCU at up to 1000 Hz, Ferrum at up to 8000 Hz (vendor-listed). [Shop input devices](/shop/input).

### Accessories

A braided USB-C data cable, a thermal kit and a compact analysis workstation for TraceCore DMA cards. [Shop accessories](/shop/accessory).

## How we work

- **Tested before dispatch.** Every unit is tested in our lab before dispatch.
- **3-month warranty.** Every product carries a 3-month warranty from the purchase date, and warranty claims are handled as replacements. See the [warranty policy](/legal/warranty).
- **Worldwide shipping.** We ship to most countries worldwide. Orders over {{freeShippingThreshold}} ship free; below that, a flat rate of {{flatShipping}} applies and is shown at checkout. See the [shipping policy](/legal/shipping).
- **Secure checkout.** Visa and Mastercard payments go through Razorpay's secure checkout.
- **Support.** Ask us on Discord, through the [support page](/support) or by email at {{supportEmail}}.

## Guides and policies

Our [guides](/guides) cover installation, drivers, setup, compatibility and troubleshooting for the hardware we sell, and the [FAQ](/faq) answers common questions about orders, shipping and warranty.

Before you order, please read our [terms of service](/legal/terms), [privacy policy](/legal/privacy), [refund policy](/legal/refunds), [shipping policy](/legal/shipping) and [warranty policy](/legal/warranty). Everything we sell is in the [shop](/shop).
`;
