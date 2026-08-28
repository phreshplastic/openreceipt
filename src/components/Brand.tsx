import { Printer } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? "brand-compact" : ""}`} aria-label="Pete’s Printer">
    <span className="brand-icon"><Printer size={compact ? 16 : 20} strokeWidth={2.4} /></span>
    <span className="brand-copy"><strong>PETE’S PRINTER</strong>{!compact && <small>MAKE A LITTLE SOMETHING</small>}</span>
  </div>;
}
