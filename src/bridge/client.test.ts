import { describe, expect, it } from "vitest";
import { usbPrinterConnected } from "./client";

describe("usbPrinterConnected", () => {
  it("is false for dummy output even when the bridge reports connected", () => {
    expect(usbPrinterConnected({ connected: true, transport: "dummy" })).toBe(false);
  });

  it("is true only for a USB printer the bridge can talk to", () => {
    expect(usbPrinterConnected({ connected: true, transport: "usb" })).toBe(true);
    expect(usbPrinterConnected({ connected: false, transport: "usb" })).toBe(false);
  });
});
