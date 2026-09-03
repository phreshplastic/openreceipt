import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PrintButton } from "./PrintButton";

const noop = () => undefined;

describe("PrintButton", () => {
  afterEach(cleanup);

  it("keeps the visible label as Print", () => {
    const { rerender } = render(<PrintButton busy={false} complete={false} disabled={false} onClick={noop} />);
    expect(screen.getByRole("button", { name: "Print" })).toBeInTheDocument();
    rerender(<PrintButton busy complete={false} disabled onClick={noop} />);
    expect(screen.getByRole("button", { name: "Printing" })).toHaveTextContent("Print");
    expect(document.querySelector(".print-pixel-grid")).not.toBeNull();
  });

  it("can label the idle action as Demo print", () => {
    render(<PrintButton busy={false} complete={false} disabled={false} idleLabel="Demo print" onClick={noop} />);
    expect(screen.getByRole("button", { name: "Demo print" })).toHaveTextContent("Demo print");
  });
});
