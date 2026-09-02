import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { webMcpToolCatalog } from "../agent/tool-catalog";
import { WebMcpTools } from "./WebMcpTools";

describe("WebMcpTools", () => {
  afterEach(cleanup);

  it("opens a list of every registered tool from the rail footer", () => {
    render(<WebMcpTools registered />);

    const launcher = screen.getByRole("button", { name: /WebMCP tools/ });
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog", { name: "Tools an agent can call" })).toBeNull();

    fireEvent.click(launcher);
    expect(launcher).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Tools an agent can call" })).toBeInTheDocument();
    expect(screen.getByText(/Registered for this page/)).toBeInTheDocument();
    for (const tool of webMcpToolCatalog) {
      expect(screen.getByText(tool.name)).toBeInTheDocument();
      expect(screen.getByText(tool.copy)).toBeInTheDocument();
    }
    expect(screen.getByText("Always waits for your approval.")).toBeInTheDocument();
  });

  it("says so when this browser has no WebMCP host", () => {
    render(<WebMcpTools registered={false} />);
    fireEvent.click(screen.getByRole("button", { name: /WebMCP tools/ }));
    expect(screen.getByText(/No WebMCP host in this browser/)).toBeInTheDocument();
  });

  it("closes from the panel control", () => {
    render(<WebMcpTools registered />);
    fireEvent.click(screen.getByRole("button", { name: /WebMCP tools/ }));
    fireEvent.click(screen.getByRole("button", { name: "Close WebMCP tools" }));
    expect(screen.queryByRole("dialog", { name: "Tools an agent can call" })).toBeNull();
  });
});
