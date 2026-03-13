import { ChangeEvent } from "react";

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

type SelectProps<T extends string> = {
  value: T;
  options: Array<SelectOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
};

export function Select<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  className = "",
}: SelectProps<T>) {
  return (
    <select
      value={value}
      onChange={(event: ChangeEvent<HTMLSelectElement>) =>
        onChange(event.target.value as T)
      }
      disabled={disabled}
      className={[
        "h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition",
        "focus:border-slate-900 focus:ring-2 focus:ring-slate-200",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}