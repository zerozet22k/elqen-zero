import { useCallback, useLayoutEffect, useRef } from "react";
import { Message } from "../../types/models";

function StatusBadge({ status }: { status?: string }) {
  const className =
    status === "sent" || status === "delivered" || status === "read"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "failed" || status === "error"
        ? "bg-rose-50 text-rose-700 ring-rose-200"
        : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium capitalize ring-1 ${className}`}
    >
      {status ?? "unknown"}
    </span>
  );
}

function renderMessageContent(
  message: Message,
  isOutbound: boolean,
  isSystem: boolean,
  onMediaLoad?: () => void
) {
  const textClass =
    isOutbound && !isSystem ? "text-slate-100" : "text-slate-800";

  switch (message.kind) {
    case "text":
    case "system":
    case "interactive":
      return (
        <p className={`whitespace-pre-wrap text-sm leading-6 ${textClass}`}>
          {message.text?.body || "No text content"}
        </p>
      );

    case "image":
      return (
        <div className="space-y-3">
          <p className={`text-sm ${textClass}`}>
            {message.text?.body || "Image received"}
          </p>

          {message.media?.[0]?.url ? (
            <img
              alt="Message media"
              src={message.media[0].url}
              onLoad={onMediaLoad}
              className="max-h-80 w-full rounded-xl border border-slate-200 object-cover"
            />
          ) : null}
        </div>
      );

    case "video":
      return (
        <p className={`text-sm leading-6 ${textClass}`}>
          {message.text?.body || "Video received"}
        </p>
      );

    case "audio":
      return (
        <p className={`text-sm leading-6 ${textClass}`}>
          {message.text?.body || "Audio received"}
        </p>
      );

    case "file":
      return (
        <p className={`text-sm leading-6 ${textClass}`}>
          {message.text?.body || "File received"}
        </p>
      );

    case "location":
      return <p className={`text-sm leading-6 ${textClass}`}>Location received</p>;

    case "contact":
      return <p className={`text-sm leading-6 ${textClass}`}>Contact received</p>;

    case "unsupported":
      return (
        <p className="text-sm leading-6 text-rose-600">
          Unsupported content: {message.unsupportedReason || "Unknown type"}
        </p>
      );

    default:
      return (
        <p className={`text-sm leading-6 ${textClass}`}>Unsupported message type</p>
      );
  }
}

export function ThreadView({ messages }: { messages: Message[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }, []);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      scrollToBottom("auto");
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [messages, scrollToBottom]);

  if (!messages.length) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        No messages yet.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-0 flex-col overflow-y-auto pr-2"
    >
      <div className="mt-auto space-y-4">
        {messages.map((message) => {
          const isOutbound = message.direction === "outbound";
          const isSystem =
            message.kind === "system" || message.senderType === "system";
          const hasDeliveryError =
            message.delivery?.error || message.meta?.deliveryError;
          const attachmentUrl = message.media?.[0]?.url;

          const wrapperClass = isSystem
            ? "flex justify-center"
            : isOutbound
              ? "flex justify-end"
              : "flex justify-start";

          const bubbleClass = isSystem
            ? "w-full max-w-xl rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3"
            : isOutbound
              ? "w-full max-w-2xl rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-white shadow-sm"
              : "w-full max-w-2xl rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm";

          return (
            <article key={message._id} className={wrapperClass}>
              <div className={bubbleClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong
                      className={
                        isOutbound && !isSystem
                          ? "text-xs font-semibold uppercase tracking-[0.12em] text-slate-300"
                          : "text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                      }
                    >
                      {message.senderType}
                    </strong>

                    <span
                      className={
                        isOutbound && !isSystem
                          ? "inline-flex rounded-full bg-white/10 px-2 py-1 text-[11px] font-medium text-slate-200 ring-1 ring-white/10 capitalize"
                          : "inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 capitalize"
                      }
                    >
                      {message.kind}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isOutbound && !isSystem ? (
                      <span className="inline-flex rounded-full bg-white/10 px-2 py-1 text-[11px] font-medium text-slate-200 ring-1 ring-white/10 capitalize">
                        {message.status ?? "unknown"}
                      </span>
                    ) : (
                      <StatusBadge status={message.status} />
                    )}

                    <span
                      className={
                        isOutbound && !isSystem
                          ? "text-[11px] text-slate-300"
                          : "text-[11px] text-slate-500"
                      }
                    >
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  {renderMessageContent(
                    message,
                    isOutbound,
                    isSystem,
                    () => scrollToBottom("auto")
                  )}
                </div>

                {attachmentUrl && message.kind !== "image" ? (
                  <div className="mt-3">
                    <a
                      href={attachmentUrl}
                      rel="noreferrer"
                      target="_blank"
                      className={
                        isOutbound && !isSystem
                          ? "text-sm font-medium text-slate-100 underline underline-offset-4"
                          : "text-sm font-medium text-slate-700 underline underline-offset-4"
                      }
                    >
                      Open attachment
                    </a>
                  </div>
                ) : null}

                {hasDeliveryError ? (
                  <div
                    className={
                      isOutbound && !isSystem
                        ? "mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"
                        : "mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    }
                  >
                    Send failed: {message.delivery?.error ?? message.meta?.deliveryError}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}

        <div ref={bottomRef} className="h-px w-full shrink-0" />
      </div>
    </div>
  );
}