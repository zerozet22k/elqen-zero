import type { EmojiClickData } from "emoji-picker-react";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CallRoundedIcon from "@mui/icons-material/CallRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SentimentSatisfiedAltRoundedIcon from "@mui/icons-material/SentimentSatisfiedAltRounded";
import {
  FormEvent,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "../services/api";
import {
  PublicWorkspaceChatMessage,
  PublicWorkspaceProfile,
} from "../types/models";
import { SITE_BRAND } from "../content/site";
import { buildPublicWorkspacePath } from "../utils/workspace-routes";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

const createSessionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `website-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const buildStorageKey = (slug: string, suffix: string) =>
  `omni-chat-public:${slug}:${suffix}`;

const trimString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const formatMessageTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const getWorkspaceSummary = (workspace: PublicWorkspaceProfile | null) => {
  if (!workspace) {
    return "";
  }

  return workspace.publicDescription || workspace.bio || "";
};

const normalizePublicUrl = (value: string) => {
  const trimmed = trimString(value);
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

const getWebsiteHostname = (value: string) => {
  try {
    return new URL(normalizePublicUrl(value)).hostname.replace(/^www\./i, "");
  } catch {
    return trimString(value);
  }
};

const getWebsiteActionLabel = (value: string) => {
  const hostname = getWebsiteHostname(value).toLowerCase();
  if (hostname.includes("facebook.com")) {
    return "Open Facebook page";
  }

  if (hostname.includes("instagram.com")) {
    return "Open Instagram profile";
  }

  if (hostname.includes("t.me") || hostname.includes("telegram.me")) {
    return "Open Telegram link";
  }

  return "Visit website";
};

type ContactAction = {
  kind: "website" | "email" | "phone";
  href: string;
  label: string;
  detail: string;
  external?: boolean;
};

const buildContactActions = (workspace: PublicWorkspaceProfile) => {
  const actions: ContactAction[] = [];
  const websiteUrl = normalizePublicUrl(workspace.publicWebsiteUrl);
  const supportEmail = trimString(workspace.publicSupportEmail);
  const supportPhone = trimString(workspace.publicSupportPhone);

  if (websiteUrl) {
    actions.push({
      kind: "website",
      href: websiteUrl,
      label: getWebsiteActionLabel(websiteUrl),
      detail: getWebsiteHostname(websiteUrl),
      external: true,
    });
  }

  if (supportEmail) {
    actions.push({
      kind: "email",
      href: `mailto:${supportEmail}`,
      label: "Email business",
      detail: supportEmail,
    });
  }

  if (supportPhone) {
    actions.push({
      kind: "phone",
      href: `tel:${supportPhone}`,
      label: "Call business",
      detail: supportPhone,
    });
  }

  return actions;
};

type WorkspaceHeaderProps = {
  brand: string;
  pageTitle: string;
  overviewPath: string;
  chatPath: string;
  isChatRoute: boolean;
  showChatTab: boolean;
};

function WorkspaceHeader({
  brand,
  pageTitle,
  overviewPath,
  chatPath,
  isChatRoute,
  showChatTab,
}: WorkspaceHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <Link
            to="/"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
          >
            {brand}
          </Link>
          <div className="truncate text-base font-semibold text-slate-950 sm:text-lg">
            {pageTitle}
          </div>
        </div>

        <nav className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 p-1">
          <NavLink
            to={overviewPath}
            end
            className={({ isActive }) =>
              [
                "inline-flex h-9 items-center rounded-xl px-4 text-sm font-medium transition",
                isActive || !isChatRoute
                  ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-600 hover:text-slate-950",
              ].join(" ")
            }
          >
            Details
          </NavLink>

          {showChatTab ? (
            <NavLink
              to={chatPath}
              className={({ isActive }) =>
                [
                  "inline-flex h-9 items-center rounded-xl px-4 text-sm font-medium transition",
                  isActive
                    ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-600 hover:text-slate-950",
                ].join(" ")
              }
            >
              Chat
            </NavLink>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

function ContactActionIcon({ kind }: { kind: ContactAction["kind"] }) {
  if (kind === "email") {
    return <MailOutlineRoundedIcon className="h-4.5 w-4.5" aria-hidden="true" />;
  }

  if (kind === "phone") {
    return <CallRoundedIcon className="h-4.5 w-4.5" aria-hidden="true" />;
  }

  return <LanguageRoundedIcon className="h-4.5 w-4.5" aria-hidden="true" />;
}

type ContactListProps = {
  workspace: PublicWorkspaceProfile;
};

function ContactList({ workspace }: ContactListProps) {
  const actions = useMemo(() => buildContactActions(workspace), [workspace]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Contact
      </div>

      {actions.length === 0 ? (
        <p className="mt-4 text-sm leading-7 text-slate-500">
          No public contact details have been added yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {actions.map((action) => (
            <a
              key={`${action.kind}:${action.href}`}
              href={action.href}
              target={action.external ? "_blank" : undefined}
              rel={action.external ? "noreferrer" : undefined}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition group-hover:bg-white">
                  <ContactActionIcon kind={action.kind} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">
                    {action.label}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {action.detail}
                  </span>
                </span>
              </div>

              <OpenInNewRoundedIcon
                className="h-4.5 w-4.5 shrink-0 text-slate-400 transition group-hover:text-slate-700"
                aria-hidden="true"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

type OverviewViewProps = {
  workspace: PublicWorkspaceProfile;
  pageTitle: string;
  chatOnline: boolean;
  senderName: string;
  chatSetupError: string | null;
  onSenderNameChange: (value: string) => void;
  onContinueToChat: (event: FormEvent) => void;
};

function OverviewView({
  workspace,
  pageTitle,
  chatOnline,
  senderName,
  chatSetupError,
  onSenderNameChange,
  onContinueToChat,
}: OverviewViewProps) {
  const summary = getWorkspaceSummary(workspace);
  const hasSenderName = !!trimString(senderName);

  return (
    <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              About
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {pageTitle}
            </h1>

            {summary ? (
              <p className="mt-4 text-sm leading-8 text-slate-600 sm:text-base">
                {summary}
              </p>
            ) : (
              <p className="mt-4 text-sm leading-8 text-slate-500 sm:text-base">
                Public workspace page.
              </p>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <ContactList workspace={workspace} />

          {chatOnline ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Chat
                </div>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                  Online
                </span>
              </div>

              <h2 className="mt-3 text-lg font-semibold text-slate-950">
                Start with your name
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Share your name first, then continue into the customer chat.
              </p>

              <form className="mt-5 space-y-3" onSubmit={onContinueToChat}>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-900">
                    Name
                  </span>
                  <input
                    value={senderName}
                    onChange={(event) => onSenderNameChange(event.target.value)}
                    placeholder="Your name"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                {chatSetupError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {chatSetupError}
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={!trimString(senderName)}
                >
                  <span>{hasSenderName ? "Continue to chat" : "Enter chat"}</span>
                  <ArrowForwardRoundedIcon className="h-4.5 w-4.5" aria-hidden="true" />
                </button>
              </form>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}

type ChatSidebarProps = {
  workspace: PublicWorkspaceProfile;
  senderName: string;
  senderEmail: string;
  chatOnline: boolean;
  chatSetupError: string | null;
  onSenderNameChange: (value: string) => void;
  onSenderEmailChange: (value: string) => void;
  onConfirmName: (event: FormEvent) => void;
};

function ChatSidebar({
  workspace,
  senderName,
  senderEmail,
  chatOnline,
  chatSetupError,
  onSenderNameChange,
  onSenderEmailChange,
  onConfirmName,
}: ChatSidebarProps) {
  const summary = getWorkspaceSummary(workspace);
  const hasSenderName = !!trimString(senderName);

  return (
    <aside className="border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
      <div className="h-full space-y-6 overflow-y-auto px-4 py-6 sm:px-6">
        {summary ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Support
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600">{summary}</p>
          </section>
        ) : null}

        <ContactList workspace={workspace} />

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {hasSenderName ? "Chat as" : "Before you chat"}
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                chatOnline
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {chatOnline ? "Online" : "Offline"}
            </span>
          </div>

          {!hasSenderName ? (
            <form className="mt-4 space-y-4" onSubmit={onConfirmName}>
              <p className="text-sm leading-7 text-slate-600">
                Start with your name so the business knows who is messaging.
              </p>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Name
                </span>
                <input
                  value={senderName}
                  onChange={(event) => onSenderNameChange(event.target.value)}
                  placeholder="Your name"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              {chatSetupError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {chatSetupError}
                </div>
              ) : null}

              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!trimString(senderName)}
              >
                <span>Continue</span>
                <ArrowForwardRoundedIcon className="h-4.5 w-4.5" aria-hidden="true" />
              </button>
            </form>
          ) : (
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Name
                </span>
                <input
                  value={senderName}
                  onChange={(event) => onSenderNameChange(event.target.value)}
                  placeholder="Your name"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-900">
                  Email <span className="text-slate-400">(optional)</span>
                </span>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(event) => onSenderEmailChange(event.target.value)}
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <p className="text-xs leading-6 text-slate-500">
                Your name is shared with the business. Email helps them follow up if the chat disconnects.
              </p>
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}

type PublicChatComposerProps = {
  text: string;
  sending: boolean;
  disabled: boolean;
  disabledReason?: string | null;
  onTextChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
};

function PublicChatComposer({
  text,
  sending,
  disabled,
  disabledReason,
  onTextChange,
  onSubmit,
}: PublicChatComposerProps) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaSelectionRef = useRef({ start: 0, end: 0 });
  const trimmedText = text.trim();
  const canSend = !disabled && !sending && !!trimmedText;

  const syncSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textareaSelectionRef.current = {
      start: textarea.selectionStart ?? textarea.value.length,
      end: textarea.selectionEnd ?? textarea.value.length,
    };
  }, []);

  const insertTextAtCursor = useCallback(
    (value: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onTextChange(`${text}${value}`);
        return;
      }

      const { start, end } = textareaSelectionRef.current;
      const nextText = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
      const nextCaretPosition = start + value.length;

      onTextChange(nextText);
      textareaSelectionRef.current = {
        start: nextCaretPosition,
        end: nextCaretPosition,
      };

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextCaretPosition, nextCaretPosition);
      });
    },
    [onTextChange, text]
  );

  const handleEmojiClick = useCallback(
    (emojiData: EmojiClickData) => {
      insertTextAtCursor(emojiData.emoji);
    },
    [insertTextAtCursor]
  );

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const minHeight = 28;
    const maxHeight = 200;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`;
  }, [text]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!pickerRef.current) {
        return;
      }

      if (!pickerRef.current.contains(event.target as Node)) {
        setEmojiOpen(false);
      }
    };

    if (emojiOpen) {
      document.addEventListener("mousedown", handlePointerDown);
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [emojiOpen]);

  return (
    <form onSubmit={onSubmit} className="border-t border-slate-200 bg-white p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        {disabledReason ? (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {disabledReason}
          </div>
        ) : null}

        <div ref={pickerRef} className="relative">
          {emojiOpen ? (
            <div className="absolute right-0 bottom-[calc(100%+12px)] z-20 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <Suspense
                fallback={
                  <div className="flex h-90 w-80 items-center justify-center text-sm text-slate-500">
                    Loading emoji picker...
                  </div>
                }
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  width={320}
                  height={360}
                  lazyLoadEmojis
                  previewConfig={{ showPreview: false }}
                  searchPlaceholder="Search emoji"
                  skinTonesDisabled
                />
              </Suspense>
            </div>
          ) : null}

          <div className="flex items-end gap-2 rounded-[28px] border border-slate-200 bg-white px-3 py-3 shadow-sm transition focus-within:border-slate-300 focus-within:shadow-md">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setEmojiOpen((current) => !current)}
              disabled={disabled || sending}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
              aria-label="Open emoji picker"
              title="Emoji"
            >
              <SentimentSatisfiedAltRoundedIcon className="h-5 w-5" aria-hidden="true" />
            </button>

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              onClick={syncSelection}
              onKeyUp={syncSelection}
              onSelect={syncSelection}
              onFocus={syncSelection}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (canSend) {
                    event.currentTarget.form?.requestSubmit();
                  }
                }
              }}
              disabled={disabled || sending}
              rows={1}
              placeholder={
                disabled ? "Add your name to start chatting" : "Write your message..."
              }
              className="min-h-7 max-h-50 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-1 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
            />

            <button
              type="submit"
              disabled={!canSend}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              aria-label="Send message"
            >
              <SendRoundedIcon className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <p>Your message will be sent directly to the business.</p>
          <p>Press Enter to send. Shift + Enter adds a new line.</p>
        </div>
      </div>
    </form>
  );
}

type ChatViewProps = {
  workspace: PublicWorkspaceProfile;
  chatOnline: boolean;
  senderName: string;
  messages: PublicWorkspaceChatMessage[];
  text: string;
  sending: boolean;
  chatLoading: boolean;
  onTextChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
};

function ChatView({
  workspace,
  chatOnline,
  senderName,
  messages,
  text,
  sending,
  chatLoading,
  onTextChange,
  onSubmit,
  scrollRef,
}: ChatViewProps) {
  const cleanSenderName = trimString(senderName);
  const hasSenderName = !!cleanSenderName;
  const composerDisabledReason = !chatOnline
    ? "Chat is unavailable right now. Use the contact actions instead."
    : !hasSenderName
      ? "Add your name first, then you can message the business."
      : null;

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-slate-50/50">
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Customer chat
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
              {hasSenderName ? `Chat as ${cleanSenderName}` : "Start a chat"}
            </h2>
          </div>

          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
              chatOnline
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {chatOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {!chatOnline ? (
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center">
            <div className="text-base font-semibold text-slate-950">Chat unavailable</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Use the contact actions on this page instead.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            {chatLoading && messages.length === 0 ? (
              <div className="text-sm text-slate-500">Loading conversation...</div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
                  <div className="text-base font-semibold text-slate-950">
                    {hasSenderName ? "Say hello" : "Add your name to begin"}
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    {hasSenderName
                      ? workspace.publicWelcomeMessage ||
                        "Send your message and the business will reply here."
                      : "Once your name is set, the composer below will be ready."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-4xl flex-col gap-3">
                {messages.map((message) => {
                  const isVisitor = message.direction === "inbound";

                  return (
                    <div
                      key={message._id}
                      className={`flex ${isVisitor ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={[
                          "max-w-[85%] rounded-[24px] px-4 py-3 text-sm shadow-sm sm:max-w-[75%]",
                          isVisitor
                            ? "bg-slate-950 text-white"
                            : "border border-slate-200 bg-white text-slate-950",
                        ].join(" ")}
                      >
                        <p className="whitespace-pre-wrap leading-6">{message.body}</p>
                        <div
                          className={`mt-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] ${
                            isVisitor ? "text-slate-300" : "text-slate-500"
                          }`}
                        >
                          <span>{isVisitor ? "You" : "Team"}</span>
                          <span>/</span>
                          <span>{formatMessageTime(message.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <PublicChatComposer
            text={text}
            sending={sending}
            disabled={!chatOnline || !hasSenderName}
            disabledReason={composerDisabledReason}
            onTextChange={onTextChange}
            onSubmit={onSubmit}
          />
        </>
      )}
    </section>
  );
}

export function PublicWorkspacePage() {
  const { slug = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isChatRoute = location.pathname.endsWith("/chat");
  const overviewPath = buildPublicWorkspacePath(slug);
  const chatPath = buildPublicWorkspacePath(slug, "chat");

  const [workspace, setWorkspace] = useState<PublicWorkspaceProfile | null>(null);
  const [messages, setMessages] = useState<PublicWorkspaceChatMessage[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatSetupError, setChatSetupError] = useState<string | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!slug || typeof window === "undefined") {
      return;
    }

    const storedSessionId =
      window.localStorage.getItem(buildStorageKey(slug, "sessionId")) ||
      createSessionId();
    const storedSenderName =
      window.localStorage.getItem(buildStorageKey(slug, "senderName")) || "";
    const storedSenderEmail =
      window.localStorage.getItem(buildStorageKey(slug, "senderEmail")) || "";

    window.localStorage.setItem(buildStorageKey(slug, "sessionId"), storedSessionId);
    setSessionId(storedSessionId);
    setSenderName(storedSenderName);
    setSenderEmail(storedSenderEmail);
  }, [slug]);

  useEffect(() => {
    if (!slug || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(buildStorageKey(slug, "senderName"), senderName);
  }, [senderName, slug]);

  useEffect(() => {
    if (!slug || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(buildStorageKey(slug, "senderEmail"), senderEmail);
  }, [senderEmail, slug]);

  const loadWorkspace = useCallback(async () => {
    if (!slug) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<{ workspace: PublicWorkspaceProfile }>(
        `/api/public/workspaces/${encodeURIComponent(slug)}`
      );
      setWorkspace(response.workspace);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to load workspace page."
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const loadMessages = useCallback(async () => {
    if (!isChatRoute || !slug || !sessionId || !workspace?.websiteChatAvailable) {
      return;
    }

    setChatLoading(true);

    try {
      const response = await apiRequest<{
        sessionId: string;
        items: PublicWorkspaceChatMessage[];
      }>(
        `/api/public/workspaces/${encodeURIComponent(
          slug
        )}/chat/${encodeURIComponent(sessionId)}/messages`
      );
      setMessages(response.items);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to load messages."
      );
    } finally {
      setChatLoading(false);
    }
  }, [isChatRoute, sessionId, slug, workspace?.websiteChatAvailable]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!isChatRoute || !workspace?.websiteChatAvailable || !sessionId) {
      return;
    }

    void loadMessages();

    const intervalId = window.setInterval(() => {
      void loadMessages();
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isChatRoute, loadMessages, sessionId, workspace?.websiteChatAvailable]);

  useEffect(() => {
    const node = conversationRef.current;
    if (!node) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [messages]);

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();

    if (!slug || !text.trim()) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await apiRequest<{ sessionId: string }>(
        `/api/public/workspaces/${encodeURIComponent(slug)}/chat`,
        {
          method: "POST",
          body: JSON.stringify({
            text: text.trim(),
            senderName: trimString(senderName) || undefined,
            senderEmail: trimString(senderEmail) || undefined,
            sessionId: sessionId || undefined,
          }),
        }
      );

      if (response.sessionId && response.sessionId !== sessionId) {
        setSessionId(response.sessionId);

        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            buildStorageKey(slug, "sessionId"),
            response.sessionId
          );
        }
      }

      setText("");
      await loadMessages();
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to send message."
      );
    } finally {
      setSending(false);
    }
  };

  const handleSenderNameChange = useCallback((value: string) => {
    setSenderName(value);
    if (trimString(value)) {
      setChatSetupError(null);
    }
  }, []);

  const handleSenderEmailChange = useCallback((value: string) => {
    setSenderEmail(value);
  }, []);

  const validateSenderName = useCallback(() => {
    if (trimString(senderName)) {
      setChatSetupError(null);
      return true;
    }

    setChatSetupError("Please add your name first.");
    return false;
  }, [senderName]);

  const handleContinueToChat = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (!validateSenderName()) {
        return;
      }

      navigate(chatPath);
    },
    [chatPath, navigate, validateSenderName]
  );

  const handleConfirmName = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      validateSenderName();
    },
    [validateSenderName]
  );

  const pageTitle = useMemo(() => workspace?.name || "Workspace", [workspace]);
  const chatOnline = !!workspace?.websiteChatAvailable && !!workspace?.publicChatEnabled;

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <div className="flex min-h-screen flex-col">
        <WorkspaceHeader
          brand={SITE_BRAND}
          pageTitle={pageTitle}
          overviewPath={overviewPath}
          chatPath={chatPath}
          isChatRoute={isChatRoute}
          showChatTab={!!slug && !!workspace?.websiteChatAvailable}
        />

        {error && !workspace ? (
          <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
            <div className="w-full max-w-xl rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
              {error}
            </div>
          </main>
        ) : null}

        {!error && loading && !workspace ? (
          <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
            <div className="text-sm text-slate-500">Loading workspace...</div>
          </main>
        ) : null}

        {!loading && workspace ? (
          <>
            {error ? (
              <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:px-6 lg:px-8">
                {error}
              </div>
            ) : null}

            {!isChatRoute ? (
              <OverviewView
                workspace={workspace}
                pageTitle={pageTitle}
                chatOnline={chatOnline}
                senderName={senderName}
                chatSetupError={chatSetupError}
                onSenderNameChange={handleSenderNameChange}
                onContinueToChat={handleContinueToChat}
              />
            ) : (
              <main className="grid min-h-0 flex-1 lg:grid-cols-[340px_minmax(0,1fr)]">
                <ChatSidebar
                  workspace={workspace}
                  senderName={senderName}
                  senderEmail={senderEmail}
                  chatOnline={chatOnline}
                  chatSetupError={chatSetupError}
                  onSenderNameChange={handleSenderNameChange}
                  onSenderEmailChange={handleSenderEmailChange}
                  onConfirmName={handleConfirmName}
                />

                <ChatView
                  workspace={workspace}
                  chatOnline={chatOnline}
                  senderName={senderName}
                  messages={messages}
                  text={text}
                  sending={sending}
                  chatLoading={chatLoading}
                  onTextChange={setText}
                  onSubmit={handleSend}
                  scrollRef={conversationRef}
                />
              </main>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
