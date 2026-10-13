import { afterEach, describe, expect, it, vi } from "vitest";
import { bridgeEventsUrl, ensureBrowserSession, preferredSetupAdapter, resolveBridgeOrigin, usbPrinterConnected } from "./client";

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
  it("preserves USB configuration when unplugged, and selects virtual only explicitly", () => {
    expect(preferredSetupAdapter({ adapter: "epson-tm-l90-usb", transport: "usb", connected: false })).toBe("epson-tm-l90-usb");
    expect(preferredSetupAdapter({ adapter: "virtual", transport: "dummy", connected: true })).toBe("virtual");
    expect(preferredSetupAdapter({ adapter: "epson-tm-l90-usb", transport: "dummy", connected: true })).toBe("virtual");
  });

  it("selects Epson only when USB is actually connected", () => {
    expect(preferredSetupAdapter({ adapter: "epson-tm-l90-usb", transport: "usb", connected: true })).toBe("epson-tm-l90-usb");
  });
});

it("uses the Pi serving origin, keeping public loopback and explicit overrides", () => {
  expect(resolveBridgeOrigin("production")).toBe("");
  expect(resolveBridgeOrigin("development")).toBe("");
  expect(resolveBridgeOrigin("public")).toBe("http://localhost:8731");
  expect(resolveBridgeOrigin("production", "https://printer.example/")).toBe("https://printer.example");
});

describe("bridgeEventsUrl", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("carries the session token, because EventSource cannot send the header apiFetch uses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ csrfToken: "csrf", sessionToken: "nonce.signature" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )));
    await ensureBrowserSession();
    const url = new URL(bridgeEventsUrl(7), "http://localhost");
    expect(url.pathname).toBe("/api/v1/events");
    expect(url.searchParams.get("after")).toBe("7");
    expect(url.searchParams.get("session")).toBe("nonce.signature");
  });
});
