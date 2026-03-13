type FilterChipProps = {
  active: boolean;
  label: string;
  onClick: () => void;
};

export function FilterChip({ active, label, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium capitalize transition",
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}