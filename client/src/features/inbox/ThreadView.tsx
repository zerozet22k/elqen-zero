import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Message } from "../../types/models";
import { resolveRenderableMedia } from "./thread-media-utils";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import NorthRoundedIcon from "@mui/icons-material/NorthRounded";

const GIF_URL_REGEX = /https?:\/\/[^\s]+\.gif(?:\?[^\s]*)?/gi;

function extractGifUrls(text: string) {
  if (!text) {
    return [];
  }
  const matches = text.match(GIF_URL_REGEX);
  return matches ? Array.from(new Set(matches)) : [];
}

function stripGifUrls(text: string) {
  if (!text) {
    return "";
  }
  return text.replace(GIF_URL_REGEX, " ").replace(/\s+/g, " ").trim();
}

function isSingleEmojiText(text: string) {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return false;
  }

  // Covers most standalone and ZWJ-composed emojis.
  return /^\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*$/u.test(
    trimmed
  );
}

function isTelegramStickerLike(message: Message) {
  if (message.channel !== "telegram") {
    return message.kind === "sticker";
  }

  if (message.kind === "sticker") {
    return true;
  }

  const meta = message.meta as Record<string, unknown> | undefined;
  if (
    meta?.isAnimated === true ||
    meta?.isVideo === true ||
    meta?.previewFromThumbnail === true
  ) {
    return true;
  }

  const firstMedia = message.media?.[0];
  const mimeType = firstMedia?.mimeType?.toLowerCase();
  const stickerMime =
    mimeType === "image/webp" ||
    mimeType === "video/webm" ||
    mimeType === "application/x-tgsticker";
  if (!stickerMime) {
    return false;
  }

  const text = message.text?.body?.trim() ?? "";
  const looksEmojiLike = text.length > 0 && text.length <= 8 && !/[a-z0-9]/i.test(text);
  return looksEmojiLike;
}

function getAttachmentLinkLabel(message: Message) {
  const filename = message.media?.[0]?.filename?.trim();
  if (filename) {
    return filename;
  }

  switch (message.kind) {
    case "video":
      return "Video";
    case "audio":
      return "Audio";
    case "file":
      return "File";
    default:
      return "Attachment";
  }
}

function isAiReviewSystemMessage(message: Message) {
  if (message.kind !== "system" && message.senderType !== "system") {
    return false;
  }

  const internalNoteType = (message.meta as Record<string, unknown> | undefined)?.internalNoteType;
  if (internalNoteType === "ai_review") {
    return true;
  }

  const body = message.text?.body ?? "";
  return (
    body.startsWith("AI draft ready for human review") ||
    body.startsWith("Draft reply ready for human review") ||
    body.startsWith("Human follow-up requested")
  );
}

function getOutboundSenderLabel(params: {
  message: Message;
  currentUserId?: string | null;
  senderNamesByUserId?: Record<string, string>;
}) {
  const { message, currentUserId, senderNamesByUserId = {} } = params;
  const actorUserId = message.meta?.actorUserId?.trim();

  if (message.senderType === "agent" || actorUserId) {
    if (actorUserId && currentUserId && actorUserId === currentUserId) {
      return "Sent by you";
    }

    if (actorUserId && senderNamesByUserId[actorUserId]?.trim()) {
      return `Sent by ${senderNamesByUserId[actorUserId].trim()}`;
    }

    return "Sent by staff";
  }

  if (message.senderType === "automation") {
    return "Sent by automation";
  }

  if (message.senderType === "ai") {
    return "Sent by bot";
  }

  return null;
}

function renderMessageContent(
  message: Message,
  isOutbound: boolean,
  isSystem: boolean,
  isAiReviewNote: boolean,
  onMediaLoad?: () => void
) {
  const textClass =
    isOutbound && !isSystem
      ? "text-slate-100"
      : isAiReviewNote
        ? "text-slate-700"
        : "text-slate-800";
  const mediaState = resolveRenderableMedia(message);
  const attachmentUrl = mediaState.preferredUrl;
  const mediaCount = message.media?.length ?? 0;
  const isSticker = isTelegramStickerLike(message);

  if (isSticker) {
    const isVideoSticker =
      message.media?.[0]?.mimeType === "video/webm" ||
      (message.meta as Record<string, unknown> | undefined)?.isVideo === true;
    const stickerUrl = attachmentUrl;
    const meta = (message.meta as Record<string, unknown> | undefined) ?? {};
    const emoji = message.text?.body;
    const stickerLabel = typeof meta.stickerLabel === "string" ? String(meta.stickerLabel) : undefined;
    const linePackageId = typeof meta.stickerPackageId === "string" ? meta.stickerPackageId : undefined;
    const lineStickerId = typeof meta.platformStickerId === "string" ? meta.platformStickerId : undefined;
    const linePackTitle = typeof meta.lineStickerPackTitle === "string" ? meta.lineStickerPackTitle : undefined;
    const lineStoreUrl = typeof meta.lineStickerStoreUrl === "string" ? meta.lineStickerStoreUrl : undefined;
    const lineStickerResourceType =
      typeof meta.lineStickerResourceType === "string" ? meta.lineStickerResourceType : undefined;
    const lineStickerKeywords = Array.isArray(meta.lineStickerKeywords)
      ? meta.lineStickerKeywords.filter((keyword): keyword is string => typeof keyword === "string")
      : [];
    const isLineSticker = message.channel === "line";

    return (
      <div className="flex flex-col items-start gap-1">
        {stickerUrl ? (
          isVideoSticker ? (
            <video
              autoPlay
              loop
              muted
              playsInline
              src={stickerUrl}
              className="h-32 w-32 object-contain"
              onLoadedMetadata={onMediaLoad}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <img
              src={stickerUrl}
              alt={emoji ?? "Sticker"}
              className="h-32 w-32 object-contain"
              onLoad={onMediaLoad}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          )
        ) : emoji ? (
          <span className="text-5xl leading-none">{emoji}</span>
        ) : (
          <span className={`text-xs ${textClass} opacity-70`}>
            {stickerLabel ?? (isLineSticker ? "LINE sticker" : "Sticker")}
          </span>
        )}

        {isLineSticker ? (
          <div className="mt-1 space-y-1">
            {linePackTitle ? <p className={`text-xs ${textClass} opacity-80`}>{linePackTitle}</p> : null}
            <p className={`text-[11px] ${textClass} opacity-70`}>
              {linePackageId ? `package ${linePackageId}` : "package unknown"}
              {lineStickerId ? ` • sticker ${lineStickerId}` : ""}
              {lineStickerResourceType ? ` • ${lineStickerResourceType}` : ""}
            </p>
            {lineStickerKeywords.length > 0 ? (
              <p className={`text-[11px] ${textClass} opacity-60`}>
                {lineStickerKeywords.slice(0, 5).join(", ")}
                {lineStickerKeywords.length > 5 ? " ..." : ""}
              </p>
            ) : null}
            {lineStoreUrl ? (
              <a
                href={lineStoreUrl}
                rel="noreferrer"
                target="_blank"
                className={
                  isOutbound && !isSystem
                    ? "text-xs font-medium text-slate-200 underline underline-offset-4"
                    : "text-xs font-medium text-slate-600 underline underline-offset-4"
                }
              >
                Open in LINE Store
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  switch (message.kind) {
    case "text":
    case "system":
    case "interactive":
      {
        const rawText = message.text?.body || "";
        const gifUrls = extractGifUrls(rawText);
        const textWithoutGifs = stripGifUrls(rawText);

        if (isSingleEmojiText(textWithoutGifs)) {
          return <span className="text-5xl leading-none">{textWithoutGifs}</span>;
        }

        return (
          <div className="space-y-3">
            {textWithoutGifs ? (
              <p className={`whitespace-pre-wrap break-all text-sm leading-6 ${textClass}`}>
                {textWithoutGifs}
              </p>
            ) : null}

            {gifUrls.map((gifUrl, index) => (
              <img
                key={`${message._id}-gif-${index}`}
                alt={`GIF ${index + 1}`}
                src={gifUrl}
                onLoad={onMediaLoad}
                className="max-h-80 w-full rounded-xl object-cover"
              />
            ))}

            {!textWithoutGifs && gifUrls.length === 0 ? (
              <p className={`whitespace-pre-wrap break-all text-sm leading-6 ${textClass}`}>
                No text content
              </p>
            ) : null}
          </div>
        );
      }

    case "image":
      return (
        <div className="space-y-3">
          {message.text?.body ? <p className={`text-sm ${textClass}`}>{message.text.body}</p> : null}

          {mediaState.items.some((item) => item.preferredUrl) ? (
            <div
              className={
                mediaState.items.length > 1
                  ? "grid grid-cols-2 gap-2"
                  : "grid grid-cols-1"
              }
            >
              {mediaState.items
                .filter((item) => item.preferredUrl)
                .map((item, index) => (
                  <img
                    key={`${message._id}-media-${index}`}
                    alt={`Message media ${index + 1}`}
                    src={item.preferredUrl as string}
                    onLoad={onMediaLoad}
                    className="max-h-80 w-full rounded-xl object-cover"
                  />
                ))}
            </div>
          ) : mediaState.isExpired ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Media expired. No durable copy available.
            </div>
          ) : null}
        </div>
      );

    case "video":
      return (
        <div className="space-y-3">
          {message.text?.body ? <p className={`text-sm leading-6 ${textClass}`}>{message.text.body}</p> : null}

          {attachmentUrl ? (
            <video
              controls
              preload="metadata"
              src={attachmentUrl}
              className="max-h-96 w-full rounded-xl border border-slate-200 bg-black"
              onLoadedMetadata={onMediaLoad}
            />
          ) : mediaCount > 1 ? (
            <p className={`text-sm leading-6 ${textClass}`}>{`${mediaCount} videos received`}</p>
          ) : null}
        </div>
      );

    case "audio":
      return (
        <div className="min-w-60 space-y-2 sm:min-w-70">
          {message.text?.body ? <p className={`text-sm leading-6 ${textClass}`}>{message.text.body}</p> : null}

          {attachmentUrl ? (
            <audio controls src={attachmentUrl} className="block w-full max-w-full" preload="metadata">
              Your browser does not support audio playback.
            </audio>
          ) : mediaCount > 1 ? (
            <p className={`text-sm leading-6 ${textClass}`}>{`${mediaCount} audio files received`}</p>
          ) : null}
        </div>
      );

    case "file":
      return (
        <div className="space-y-2">
          {message.text?.body ? <p className={`text-sm leading-6 ${textClass}`}>{message.text.body}</p> : null}
          
          {mediaState.items.some((item) => item.preferredUrl) ? (
            <div className="space-y-2">
              {mediaState.items
                .filter((item) => item.preferredUrl)
                .map((item, index) => {
                  const filename = item.filename || `file-${index + 1}`;
                  const filesize = item.size ? `${(item.size / 1024 / 1024).toFixed(2)}MB` : "Unknown size";
                  
                  return (
                    <a
                      key={`${message._id}-file-${index}`}
                      href={item.preferredUrl as string}
                      download={filename}
                      className={
                        isOutbound && !isSystem
                          ? "inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700"
                          : "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      }
                    >
                      <DownloadRoundedIcon className="h-4 w-4" aria-hidden="true" />
                      <div className="text-left">
                        <p className="truncate">{filename}</p>
                        <p className="text-xs opacity-70">{filesize}</p>
                      </div>
                    </a>
                  );
                })}
            </div>
          ) : mediaState.isExpired ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              File expired. No durable copy available.
            </div>
          ) : mediaCount > 0 ? (
            <p className={`text-sm leading-6 ${textClass}`}>{`${mediaCount} file(s) received`}</p>
          ) : null}
        </div>
      );

    case "location":
      return (
        <div className="space-y-2">
          {message.text?.body ? <p className={`text-sm leading-6 ${textClass}`}>{message.text.body}</p> : null}
          {typeof message.location?.lat === "number" && typeof message.location?.lng === "number" ? (
            <>
              <p className={`text-sm leading-6 ${textClass}`}>
                {message.location.lat.toFixed(6)}, {message.location.lng.toFixed(6)}
              </p>
              <a
                href={`https://www.google.com/maps?q=${message.location.lat},${message.location.lng}`}
                rel="noreferrer"
                target="_blank"
                className={
                  isOutbound && !isSystem
                    ? "text-sm font-medium text-slate-100 underline underline-offset-4"
                    : "text-sm font-medium text-slate-700 underline underline-offset-4"
                }
              >
                Open location in maps
              </a>
            </>
          ) : (
            <p className={`text-sm leading-6 ${textClass}`}>Location received</p>
          )}
          {message.location?.label ? (
            <p className={`text-xs ${textClass} opacity-80`}>{message.location.label}</p>
          ) : null}
        </div>
      );

    case "contact":
      return (
        <div className="space-y-1">
          {message.contact?.name ? (
            <p className={`text-sm leading-6 ${textClass}`}>{message.contact.name}</p>
          ) : (
            <p className={`text-sm leading-6 ${textClass}`}>Contact received</p>
          )}
          {message.contact?.phone ? (
            <a
              href={`tel:${message.contact.phone}`}
              className={
                isOutbound && !isSystem
                  ? "text-sm font-medium text-slate-100 underline underline-offset-4"
                  : "text-sm font-medium text-slate-700 underline underline-offset-4"
              }
            >
              {message.contact.phone}
            </a>
          ) : null}
        </div>
      );

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

type ThreadViewProps = {
  messages: Message[];
  replyingByLabel?: string | null;
  currentUserId?: string | null;
  senderNamesByUserId?: Record<string, string>;
};

export function ThreadView({
  messages,
  replyingByLabel = null,
  currentUserId = null,
  senderNamesByUserId = {},
}: ThreadViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [dismissedMessageIds, setDismissedMessageIds] = useState<Set<string>>(new Set());

  const dismissMessage = useCallback((messageId: string) => {
    setDismissedMessageIds((current) => {
      const next = new Set(current);
      next.add(messageId);
      return next;
    });
  }, []);

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
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        No messages yet.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-0 flex-col overflow-y-auto pr-2"
    >
      <div className="mt-auto space-y-2">
        <div className="flex justify-center py-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
            <NorthRoundedIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Start of conversation</span>
          </div>
        </div>

        {messages.map((message) => {
          if (dismissedMessageIds.has(message._id)) {
            return null;
          }

          const isOutbound = message.direction === "outbound";
          const isSystem =
            message.kind === "system" || message.senderType === "system";
          const isAiReviewNote = isAiReviewSystemMessage(message);
          const isSticker = isTelegramStickerLike(message);
          const outboundSenderLabel =
            isOutbound && !isSystem
              ? getOutboundSenderLabel({
                  message,
                  currentUserId,
                  senderNamesByUserId,
                })
              : null;
          const hasDeliveryError =
            message.delivery?.error || message.meta?.deliveryError;
          const mediaState = resolveRenderableMedia(message);
          const attachmentUrl = mediaState.preferredUrl;
          const attachmentLinkLabel = getAttachmentLinkLabel(message);

          const wrapperClass = isSystem
            ? "flex justify-center"
            : isOutbound
              ? "flex justify-end"
              : "flex justify-start";

          const bubbleClass = isSystem
            ? isAiReviewNote
              ? "relative max-w-[70%] overflow-hidden rounded-2xl border border-slate-300 bg-slate-100/85 px-4 py-3 pr-10 break-words"
              : "max-w-[70%] overflow-hidden rounded-xl bg-slate-50 px-3 py-1.5 break-words"
            : isOutbound
              ? "max-w-[70%] overflow-hidden rounded-2xl rounded-br-sm bg-slate-800 px-3.5 py-2.5 text-white break-words"
              : "max-w-[70%] overflow-hidden rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5 break-words";

          return (
            <article key={message._id} className={wrapperClass}>
              <div className={bubbleClass}>
                {outboundSenderLabel ? (
                  <div className="mb-1.5 flex justify-end">
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/55">
                      {outboundSenderLabel}
                    </span>
                  </div>
                ) : null}

                {isAiReviewNote ? (
                  <button
                    type="button"
                    aria-label="Close AI review note"
                    title="Close"
                    onClick={() => dismissMessage(message._id)}
                    className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white/70 text-slate-500 transition hover:bg-white hover:text-slate-700"
                  >
                    <span aria-hidden="true" className="text-sm leading-none">&times;</span>
                  </button>
                ) : null}

                {renderMessageContent(
                  message,
                  isOutbound,
                  isSystem,
                  isAiReviewNote,
                  () => scrollToBottom("auto")
                )}

                {attachmentUrl && !["image", "video", "audio", "file"].includes(message.kind) && !isSticker ? (
                  <div className="mt-2">
                    <a
                      href={attachmentUrl}
                      rel="noreferrer"
                      target="_blank"
                      className={
                        isOutbound && !isSystem
                          ? "text-sm font-medium text-slate-200 underline underline-offset-4"
                          : "text-sm font-medium text-slate-600 underline underline-offset-4"
                      }
                    >
                      {attachmentLinkLabel}
                    </a>
                  </div>
                ) : mediaState.isExpired && !["image", "video", "audio", "file"].includes(message.kind) && !isSticker ? (
                  <div className="mt-2 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs text-amber-800">
                    Attachment expired.
                  </div>
                ) : null}

                {hasDeliveryError ? (
                  <div
                    className={
                      isOutbound && !isSystem
                        ? "mt-2 rounded-lg bg-rose-500/20 px-2.5 py-1.5 text-xs text-rose-200"
                        : "mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-600"
                    }
                  >
                    {message.delivery?.error ?? message.meta?.deliveryError}
                  </div>
                ) : null}

                <div className="mt-1 flex justify-end">
                  <span
                    className={`text-[10px] ${
                      isOutbound && !isSystem ? "text-white/40" : "text-slate-400"
                    }`}
                  >
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </article>
          );
        })}

        {replyingByLabel ? (
          <div className="flex justify-end">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-[11px] font-medium text-slate-100 ring-1 ring-slate-700">
              <span className="inline-flex items-center gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-100" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-100 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-100 [animation-delay:240ms]" />
              </span>
              <span>Replying: {replyingByLabel}</span>
            </div>
          </div>
        ) : null}

        <div ref={bottomRef} className="h-px w-full shrink-0" />
      </div>
    </div>
  );
}
