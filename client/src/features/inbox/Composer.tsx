import { FormEvent, KeyboardEvent, useMemo, useState } from "react";

type ComposerProps = {
  disabled?: boolean;
  disabledReason?: string;
  error?: string;
  onSend: (text: string) => Promise<void>;
};

export function Composer({
  disabled = false,
  disabledReason,
  error,
  onSend,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const trimmedText = useMemo(() => text.trim(), [text]);
  const isDisabled = disabled || sending;
  const canSend = !isDisabled && Boolean(trimmedText);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!trimmedText || isDisabled) {
      return;
    }

    try {
      setSending(true);
      await onSend(trimmedText);
      setText("");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (!canSend) return;

      try {
        setSending(true);
        await onSend(trimmedText);
        setText("");
      } finally {
        setSending(false);
      }
    }
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      {disabledReason ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {disabledReason}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <textarea
          disabled={isDisabled}
          placeholder="Reply to the customer..."
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        />

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Press Ctrl/Cmd + Enter to send</span>
            <span className="text-slate-300">•</span>
            <span>{trimmedText.length} chars</span>
          </div>

          <button
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={!canSend}
            type="submit"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </form>
  );
}