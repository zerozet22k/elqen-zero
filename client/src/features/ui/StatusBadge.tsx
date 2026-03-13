type StatusBadgeTone = "default" | "blue" | "amber" | "emerald" | "rose";

type StatusBadgeProps = {
  label: string;
  tone?: StatusBadgeTone;
  className?: string;
};

export function StatusBadge({
  label,
  tone = "default",
  className = "",
}: StatusBadgeProps) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : tone === "emerald"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : tone === "rose"
            ? "bg-rose-50 text-rose-700 ring-rose-200"
            : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ${toneClass} ${className}`}
    >
      {label}
    </span>
  );
}