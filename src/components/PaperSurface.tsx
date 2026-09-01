import { forwardRef, type ComponentPropsWithoutRef } from "react";

const RECEIPT_TOOTH_COUNT = 40;
const RECEIPT_TOOTH_DEPTH = 4;

function createReceiptClipPath(toothCount = RECEIPT_TOOTH_COUNT, toothDepth = RECEIPT_TOOTH_DEPTH) {
  const points = Array.from({ length: toothCount * 2 }, (_, index) => {
    const x = 100 - ((index + 1) * 100) / (toothCount * 2);
    const y = index % 2 === 0 ? "100%" : `calc(100% - ${toothDepth}px)`;
    return `${x}% ${y}`;
  }).join(", ");
  return `polygon(0 0, 100% 0, 100% calc(100% - ${toothDepth}px), ${points})`;
}

const receiptPaperClipPath = createReceiptClipPath();

export const PaperSurface = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function PaperSurface({ className = "", style, ...props }, ref) {
  return <div
    ref={ref}
    className={`paper-surface ${className}`.trim()}
    style={{ ...style, clipPath: receiptPaperClipPath }}
    {...props}
  />;
});
