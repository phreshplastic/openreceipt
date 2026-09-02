import site from "../../content/site.json";

const brandMarkSrc = "/openreceipt-mark.png";

export function Brand({ compact = false, icon = true, href }: { compact?: boolean; icon?: boolean; href?: string }) {
  const className = `brand ${compact ? "brand-compact" : ""} ${icon ? "" : "brand-text"}`.trim();
  const inner = <>
    {icon && <span className="brand-icon" aria-hidden="true"><img src={brandMarkSrc} alt="" width={compact ? 16 : 20} height={compact ? 22 : 28} /></span>}
    <span className="brand-copy"><strong>{site.name}</strong>{!compact && <small>Make a little something</small>}</span>
  </>;
  if (href) return <a className={className} href={href} aria-label={site.name}>{inner}</a>;
  return <div className={className} aria-label={site.name}>{inner}</div>;
}
