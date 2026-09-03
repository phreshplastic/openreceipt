import { describe, expect, it } from "vitest";
import { preferredSetupAdapter, usbPrinterConnected } from "./client";

describe("usbPrinterConnected", () => {
  it("is false for dummy output even when the bridge reports connected", () => {
    expect(usbPrinterConnected({ connected: true, transport: "dummy" })).toBe(false);
  });

  it("is true only for a USB printer the bridge can talk to", () => {
    expect(usbPrinterConnected({ connected: true, transport: "usb" })).toBe(true);
    expect(usbPrinterConnected({ connected: false, transport: "usb" })).toBe(false);
  });
});

describe("preferredSetupAdapter", () => {
  it("selects the virtual printer when Epson is missing or dummy", () => {
    expect(preferredSetupAdapter({ adapter: "epson-tm-l90-usb", transport: "usb", connected: false })).toBe("virtual");
    expect(preferredSetupAdapter({ adapter: "virtual", transport: "dummy", connected: true })).toBe("virtual");
    expect(preferredSetupAdapter({ adapter: "epson-tm-l90-usb", transport: "dummy", connected: true })).toBe("virtual");
  });

  it("selects Epson only when USB is actually connected", () => {
    expect(preferredSetupAdapter({ adapter: "epson-tm-l90-usb", transport: "usb", connected: true })).toBe("epson-tm-l90-usb");
  });
});
