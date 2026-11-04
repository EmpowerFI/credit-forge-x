/** "EmpowerFI" and the mark, as the diary's screens open: the wordmark first, the gold mark after it. */
export function DiaryLogo({ size = "md" }: { size?: "md" | "lg" }) {
  const mark = size === "lg" ? 30 : 26;
  return (
    <span className="inline-flex items-center gap-2" aria-label="EmpowerFI Diário">
      <span aria-hidden="true" className={`font-heading font-semibold tracking-[0.01em] ${size === "lg" ? "text-2xl" : "text-xl"}`}>EmpowerFI</span>
      <img src="/empowerfi-mark.png" alt="" aria-hidden="true" width={mark} height={mark} className="shrink-0 rounded-[5px]"
        style={{ width: mark, height: mark }} />
    </span>
  );
}

/** Her initial in a navy circle, beside her name. */
export function Avatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "·";
  return (
    <span aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-base font-semibold text-primary-foreground">
      {initial}
    </span>
  );
}
