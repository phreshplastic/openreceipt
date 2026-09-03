import { Check, Printer } from "lucide-react";

type Props = {
  busy: boolean;
  complete: boolean;
  disabled: boolean;
  title?: string;
  idleLabel?: string;
  onClick(): void;
};

export function PrintButton({ busy, complete, disabled, title, idleLabel = "Print", onClick }: Props) {
  const status = complete ? "Printed" : busy ? "Printing" : idleLabel;
  return <button
    type="button"
    className={`button primary print-button ${busy ? "is-busy" : ""} ${complete ? "is-complete" : ""}`}
    onClick={onClick}
    disabled={disabled}
    title={title ?? (status === idleLabel ? undefined : status)}
    aria-label={status}
    aria-busy={busy}
  >
    <span className="print-button-icon">
      {busy ? <PixelDriveGrid /> : complete ? <Check size={16} /> : <Printer size={16} />}
    </span>
    <span className={`print-button-text ${busy ? "is-busy" : ""}`}>{idleLabel}</span>
  </button>;
}

function PixelDriveGrid() {
  return <span className="print-pixel-grid" aria-hidden="true">
    {Array.from({ length: 9 }, (_, index) => <i key={index} style={{ animationDelay: `${(index % 3) * 140}ms` }} />)}
  </span>;
}
