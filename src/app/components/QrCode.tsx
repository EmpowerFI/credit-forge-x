import { useMemo } from "react";
import qrcode from "qrcode-generator";

/** A QR code as crisp SVG, dark on white with a quiet zone, so any wallet camera reads it in either theme. */
export default function QrCode({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    }
    return { size: n + 8, path: d };
  }, [value]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges"
      className={`rounded-lg bg-white ${className}`}>
      <path d={path} fill="#0b0d12" />
    </svg>
  );
}
