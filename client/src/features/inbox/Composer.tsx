import type { EmojiClickData } from "emoji-picker-react";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import NotesRoundedIcon from "@mui/icons-material/NotesRounded";
import SentimentSatisfiedAltRoundedIcon from "@mui/icons-material/SentimentSatisfiedAltRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  Suspense,
  useEffect,
  useLayoutEffect,
  lazy,
  useMemo,
  useRef,
  useState,
} from "react";
import { API_BASE_URL } from "../../services/api-base";
import { Channel } from "../../types/models";
import { StickerCatalog, StickerCatalogItem } from "./sticker-catalog";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

export type ComposerSendPayload = {
  text: string;
  attachment: File | null;
};

export type ComposerSendStickerPayload = {
  platformStickerId: string;
  packageId?: string;
  stickerResourceType?: string;
  label?: string;
  description?: string;
  emoji?: string;
};

type ComposerProps = {
  disabled?: boolean;
  disabledReason?: string;
  error?: string;
  aiControl?: {
    primaryLabel: string;
    onPrimary: () => Promise<void>;
    secondaryLabel?: string;
    onSecondary?: () => Promise<void>;
    disabled?: boolean;
    secondaryDisabled?: boolean;
  } | null;
  aiControlError?: string | null;
  channel?: Channel | null;
  cannedReplies?: Array<{
    _id: string;
    title: string;
    body: string;
    triggers: string[];
    isActive?: boolean;
  }>;
  stickerCatalog?: StickerCatalog | null;
  stickerCatalogError?: string | null;
  isStickerCatalogLoading?: boolean;
  onSend: (payload: ComposerSendPayload) => Promise<void>;
  onSendSticker?: (payload: ComposerSendStickerPayload) => Promise<void>;
  onComposeActivityChange?: (active: boolean) => void;
};

type UtilityPanelTab = "canned" | "emoji" | "stickers";

const getChannelLabel = (channel?: Channel | null) => {
  if (!channel) {
    return "Unknown";
  }

  return channel.slice(0, 1).toUpperCase() + channel.slice(1);
};

const resolvePreviewUrl = (url?: string) => {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url, API_BASE_URL).toString();
  } catch {
    return url;
  }
};

function StickerTilePreview({ item }: { item: StickerCatalogItem }) {
  const [hasPreviewError, setHasPreviewError] = useState(false);
  const preview = item.preview;
  const previewUrl = resolvePreviewUrl(preview?.url);

  if (!hasPreviewError && preview?.kind === "video" && previewUrl) {
    return (
      <video
        autoPlay
        loop
        muted
        playsInline
        src={previewUrl}
        className="h-18 w-18 object-contain"
        onError={() => setHasPreviewError(true)}
      />
    );
  }

  if (
    !hasPreviewError &&
    (preview?.kind === "image" || preview?.kind === "fallback") &&
    previewUrl
  ) {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <img
          src={previewUrl}
          alt={item.label}
          className="h-18 w-18 object-contain"
          loading="lazy"
          onError={() => setHasPreviewError(true)}
        />
        {preview.kind === "fallback" ? (
          <span className="absolute right-2 bottom-2 rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Preview
          </span>
        ) : null}
      </div>
    );
  }

  if (preview?.kind === "tgs") {
    return (
      <div className="flex flex-col items-center justify-center gap-1 text-center">
        <span className="text-4xl leading-none">{item.emoji ?? "✨"}</span>
        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          TGS
        </span>
      </div>
    );
  }

  return <span className="text-4xl leading-none">{item.emoji ?? "🙂"}</span>;
}

export function Composer({
  disabled = false,
  disabledReason,
  error,
  aiControl,
  aiControlError,
  channel,
  cannedReplies = [],
  stickerCatalog,
  stickerCatalogError,
  isStickerCatalogLoading = false,
  onSend,
  onSendSticker,
  onComposeActivityChange,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [activeUtilityPanel, setActiveUtilityPanel] = useState<UtilityPanelTab | null>(null);
  const [activeCannedReplyIndex, setActiveCannedReplyIndex] = useState(0);
  const [customStickerId, setCustomStickerId] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaSelectionRef = useRef({ start: 0, end: 0 });
  const utilityPanelRef = useRef<HTMLDivElement | null>(null);

  const trimmedText = useMemo(() => text.trim(), [text]);
  const isDisabled = disabled || sending;
  const canSend = !isDisabled && (Boolean(trimmedText) || Boolean(attachment));
  const stickerChannelSupported =
    stickerCatalog?.supported ??
    (channel === "telegram" || channel === "viber" || channel === "line");
  const canUseStickerPicker =
    stickerChannelSupported &&
    (channel === "telegram" || channel === "viber" || channel === "line");
  const canUseCustomStickerId = channel === "telegram" || channel === "viber";
  const stickerItems = stickerCatalog?.items ?? [];
  const cannedReplyMatch =
    !attachment && !/^\/sticker\b/i.test(trimmedText)
      ? trimmedText.match(/^\/(.*)$/)
      : null;
  const cannedReplyQuery = cannedReplyMatch?.[1]?.trim().toLowerCase() ?? null;
  const cannedReplySuggestions = useMemo(() => {
    if (cannedReplyQuery === null) {
      return [];
    }

    const activeReplies = cannedReplies.filter((item) => item.isActive !== false);
    if (!cannedReplyQuery) {
      return activeReplies.slice(0, 6);
    }

    return activeReplies
      .filter((item) => {
        const haystack = `${item.title} ${item.body} ${item.triggers.join(" ")}`.toLowerCase();
        return haystack.includes(cannedReplyQuery);
      })
      .slice(0, 6);
  }, [cannedReplies, cannedReplyQuery]);

  const resetComposer = () => {
    setText("");
    setAttachment(null);
    textareaSelectionRef.current = { start: 0, end: 0 };
  };

  const syncTextareaSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textareaSelectionRef.current = {
      start: textarea.selectionStart ?? textarea.value.length,
      end: textarea.selectionEnd ?? textarea.value.length,
    };
  };

  const insertTextAtCursor = (value: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setText((current) => `${current}${value}`);
      return;
    }

    const { start, end } = textareaSelectionRef.current;
    const nextText = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
    const nextCaretPosition = start + value.length;

    setText(nextText);
    textareaSelectionRef.current = {
      start: nextCaretPosition,
      end: nextCaretPosition,
    };

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
  };

  const applyCannedReply = (replyBody: string) => {
    const normalizedBody = replyBody.trim();
    setText(normalizedBody);
    setActiveCannedReplyIndex(0);

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }

      const caret = normalizedBody.length;
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
      textareaSelectionRef.current = { start: caret, end: caret };
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isDisabled || (!trimmedText && !attachment)) {
      return;
    }

    try {
      setSending(true);
      await onSend({ text: trimmedText, attachment });
      resetComposer();
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (cannedReplySuggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveCannedReplyIndex((current) =>
          Math.min(current + 1, cannedReplySuggestions.length - 1)
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveCannedReplyIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applyCannedReply(
          cannedReplySuggestions[activeCannedReplyIndex]?.body ??
            cannedReplySuggestions[0]?.body ??
            ""
        );
        return;
      }
    }

    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (!canSend) {
        return;
      }

      try {
        setSending(true);
        await onSend({ text: trimmedText, attachment });
        resetComposer();
      } finally {
        setSending(false);
      }
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setAttachment(file);
  };

  const handleSendSticker = async (
    input: string | StickerCatalogItem | ComposerSendStickerPayload
  ) => {
    if (isDisabled || !onSendSticker) {
      return;
    }

    const payload =
      typeof input === "string"
        ? {
            platformStickerId: input.trim(),
          }
        : "id" in input
          ? {
              platformStickerId: input.platformStickerId.trim(),
              packageId: input.providerMeta?.line?.packageId?.trim(),
              stickerResourceType: input.providerMeta?.line?.stickerResourceType?.trim(),
              label: input.label,
              description: input.description,
              emoji: input.emoji,
            }
          : "platformStickerId" in input
          ? {
              platformStickerId: input.platformStickerId.trim(),
              packageId: input.packageId?.trim(),
              stickerResourceType: input.stickerResourceType?.trim(),
              label: input.label,
              description: input.description,
              emoji: input.emoji,
            }
          : null;

    if (!payload?.platformStickerId) {
      return;
    }

    try {
      setSending(true);
      await onSendSticker(payload);
      setActiveUtilityPanel(null);
      setCustomStickerId("");
    } finally {
      setSending(false);
    }
  };

  const handleTogglePanel = () => {
    if (sending) {
      return;
    }

    setActiveUtilityPanel((current) => (current ? null : "emoji"));
  };

  const handleOpenCannedReplies = () => {
    if (sending) {
      return;
    }

    setActiveUtilityPanel((current) => (current === "canned" ? null : "canned"));
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    insertTextAtCursor(emojiData.emoji);
  };

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const minHeight = 24;
    const maxHeight = 200;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`;
  }, [text]);

  useEffect(() => {
    setActiveUtilityPanel(null);
    setCustomStickerId("");
  }, [channel]);

  useEffect(() => {
    if (activeUtilityPanel === "stickers" && !canUseStickerPicker) {
      setActiveUtilityPanel(null);
    }
  }, [activeUtilityPanel, canUseStickerPicker]);

  useEffect(() => {
    setActiveCannedReplyIndex(0);
  }, [cannedReplyQuery]);

  useEffect(() => {
    syncTextareaSelection();
  }, []);

  useEffect(() => {
    return () => {
      onComposeActivityChange?.(false);
    };
  }, [onComposeActivityChange]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!utilityPanelRef.current) {
        return;
      }

      if (!utilityPanelRef.current.contains(event.target as Node)) {
        setActiveUtilityPanel(null);
      }
    };

    if (activeUtilityPanel) {
      document.addEventListener("mousedown", onPointerDown);
    }

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [activeUtilityPanel]);

  return (
    <form className="space-y-1.5" onSubmit={handleSubmit}>
      {disabledReason ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {disabledReason}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {aiControlError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {aiControlError}
        </div>
      ) : null}

      {attachment ? (
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
          <span className="max-w-55 truncate">{attachment.name}</span>
          <button
            type="button"
            className="text-slate-400 transition-colors hover:text-slate-700"
            onClick={() => setAttachment(null)}
            disabled={isDisabled}
            aria-label="Remove attachment"
          >
            x
          </button>
        </div>
      ) : null}

      {cannedReplyQuery !== null ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-2 py-2 shadow-sm">
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Canned Replies
          </div>
          {cannedReplySuggestions.length ? (
            <div className="space-y-1">
              {cannedReplySuggestions.map((reply, index) => (
                <button
                  key={reply._id}
                  type="button"
                  className={[
                    "w-full rounded-xl px-3 py-2 text-left transition",
                    index === activeCannedReplyIndex
                      ? "bg-slate-900 text-white"
                      : "hover:bg-slate-50",
                  ].join(" ")}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyCannedReply(reply.body)}
                >
                  <p
                    className={`truncate text-sm font-semibold ${
                      index === activeCannedReplyIndex ? "text-white" : "text-slate-800"
                    }`}
                  >
                    {reply.title}
                  </p>
                  <p
                    className={`truncate text-xs ${
                      index === activeCannedReplyIndex
                        ? "text-slate-200"
                        : "text-slate-500"
                    }`}
                  >
                    {reply.body}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">
              No canned replies match. Type to search by title or trigger.
            </div>
          )}
          <div className="px-3 pt-2 text-[11px] text-slate-400">
            Press `Enter` or `Tab` to insert. `/sticker &lt;id&gt;` still works separately.
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
        {aiControl ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void aiControl.onPrimary()}
              disabled={sending || aiControl.disabled}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-slate-300 hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              title={aiControl.primaryLabel}
              aria-label={aiControl.primaryLabel}
            >
              <ScheduleRoundedIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            {aiControl.secondaryLabel && aiControl.onSecondary ? (
              <button
                type="button"
                onClick={() => void aiControl.onSecondary?.()}
                disabled={sending || aiControl.secondaryDisabled}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                title={aiControl.secondaryLabel}
                aria-label={aiControl.secondaryLabel}
              >
                <AutorenewRoundedIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}

        <label
          className="shrink-0 cursor-pointer text-slate-400 transition-colors hover:text-slate-600"
          aria-label="Attach file"
        >
          <AttachFileRoundedIcon className="h-5 w-5" aria-hidden="true" />
          <input
            type="file"
            disabled={isDisabled}
            onChange={onFileChange}
            className="hidden"
          />
        </label>

        <textarea
          ref={textareaRef}
          disabled={isDisabled}
          placeholder="Write a message..."
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => onComposeActivityChange?.(true)}
          onClick={syncTextareaSelection}
          onKeyDown={handleKeyDown}
          onKeyUp={syncTextareaSelection}
          onSelect={syncTextareaSelection}
          onBlur={() => {
            syncTextareaSelection();
            onComposeActivityChange?.(false);
          }}
          rows={1}
          className="min-h-6 max-h-50 flex-1 resize-none overflow-y-auto bg-transparent text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
        />

        <div ref={utilityPanelRef} className="relative flex shrink-0 items-center gap-1.5">
          {activeUtilityPanel ? (
            <div className="absolute right-0 bottom-11 z-20 w-88 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
                <div className="inline-flex items-center rounded-full bg-white p-1 shadow-sm">
                  <button
                    type="button"
                    className={[
                      "rounded-full px-3 py-1 text-xs font-semibold transition",
                      activeUtilityPanel === "canned"
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:text-slate-800",
                    ].join(" ")}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setActiveUtilityPanel("canned")}
                  >
                    Canned
                  </button>
                  <button
                    type="button"
                    className={[
                      "rounded-full px-3 py-1 text-xs font-semibold transition",
                      activeUtilityPanel === "emoji"
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:text-slate-800",
                    ].join(" ")}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setActiveUtilityPanel("emoji")}
                  >
                    Emoji
                  </button>
                  {canUseStickerPicker ? (
                    <button
                      type="button"
                      className={[
                        "rounded-full px-3 py-1 text-xs font-semibold transition",
                        activeUtilityPanel === "stickers"
                          ? "bg-slate-900 text-white"
                          : "text-slate-500 hover:text-slate-800",
                      ].join(" ")}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setActiveUtilityPanel("stickers")}
                    >
                      Stickers
                    </button>
                  ) : null}
                </div>

                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-500 shadow-sm">
                  {getChannelLabel(channel)}
                </span>
              </div>

              <div className="max-h-96 overflow-y-auto p-3">
                {activeUtilityPanel === "canned" ? (
                  <div className="space-y-1">
                    {cannedReplies.filter((item) => item.isActive !== false).length ? (
                      cannedReplies
                        .filter((item) => item.isActive !== false)
                        .slice(0, 12)
                        .map((reply) => (
                          <button
                            key={reply._id}
                            type="button"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-100"
                            onClick={() => {
                              applyCannedReply(reply.body);
                              setActiveUtilityPanel(null);
                            }}
                          >
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {reply.title}
                            </p>
                            <p className="truncate text-xs text-slate-500">{reply.body}</p>
                          </button>
                        ))
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                        No active canned replies yet.
                      </div>
                    )}
                  </div>
                ) : activeUtilityPanel === "emoji" ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <Suspense
                      fallback={
                        <div className="flex h-90 items-center justify-center text-sm text-slate-500">
                          Loading emoji picker...
                        </div>
                      }
                    >
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width="100%"
                        height={360}
                        lazyLoadEmojis
                        previewConfig={{ showPreview: false }}
                        searchPlaceholder="Search emoji"
                        skinTonesDisabled
                      />
                    </Suspense>
                  </div>
                ) : canUseStickerPicker ? (
                  <div className="space-y-3">
                    {stickerCatalogError ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {stickerCatalogError}
                      </div>
                    ) : null}

                    {isStickerCatalogLoading ? (
                      <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
                        Loading stickers...
                      </div>
                    ) : stickerChannelSupported ? (
                      <>
                        {stickerItems.length ? (
                          <div className="grid grid-cols-2 gap-2">
                            {stickerItems.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className="rounded-2xl border border-slate-200 bg-slate-50 p-2 text-left transition hover:border-slate-300 hover:bg-slate-100"
                                onClick={() => void handleSendSticker(item)}
                                disabled={isDisabled}
                                title={`${item.label} (${item.platformStickerId})`}
                              >
                                <div className="flex h-20 items-center justify-center overflow-hidden rounded-xl bg-white">
                                  <StickerTilePreview item={item} />
                                </div>
                                <p className="mt-2 truncate text-xs font-semibold text-slate-800">
                                  {item.label}
                                </p>
                                {item.description ? (
                                  <p className="truncate text-[11px] text-slate-500">{item.description}</p>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                            No stickers are available for this conversation yet.
                          </div>
                        )}

                        {canUseCustomStickerId ? (
                          <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              Custom Sticker ID
                            </p>
                            <input
                              value={customStickerId}
                              onChange={(event) => setCustomStickerId(event.target.value)}
                              placeholder={
                                channel === "viber"
                                  ? "Paste Viber sticker_id"
                                  : "Paste Telegram file_id"
                              }
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-slate-400"
                            />
                            <button
                              type="button"
                              className="h-9 w-full rounded-xl bg-slate-900 text-xs font-semibold text-white transition hover:bg-slate-950 disabled:bg-slate-300"
                              onClick={() => void handleSendSticker(customStickerId)}
                              disabled={isDisabled || !customStickerId.trim()}
                            >
                              Send sticker ID
                            </button>
                            <p className="text-[11px] text-slate-400">
                              `/sticker &lt;id&gt;` still works as a fallback.
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-500">
                            LINE stickers are sent from saved workspace stickers because each
                            sticker needs both a package ID and a sticker ID.
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                        Direct sticker sending is available for Telegram, Viber, and LINE conversations.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                    Sticker sending is not available for this channel.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className={[
              "rounded-full p-1 text-slate-400 transition-colors hover:text-slate-700",
              activeUtilityPanel === "canned" ? "text-slate-700" : "",
            ].join(" ")}
            aria-label="Open canned replies"
            title="Canned replies"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleOpenCannedReplies}
            disabled={sending}
          >
            <NotesRoundedIcon className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            className={[
              "rounded-full p-1 text-slate-400 transition-colors hover:text-slate-700",
              activeUtilityPanel ? "text-slate-700" : "",
            ].join(" ")}
            aria-label="Open emoji and sticker tools"
            title="Emoji and stickers"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleTogglePanel}
            disabled={sending}
          >
            <SentimentSatisfiedAltRoundedIcon className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-white transition hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400"
          >
            {sending ? (
              <AutorenewRoundedIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <SendRoundedIcon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
