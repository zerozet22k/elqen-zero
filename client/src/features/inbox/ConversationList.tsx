import { Conversation } from "../../types/models";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import SouthRoundedIcon from "@mui/icons-material/SouthRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import { PlatformIcons } from "../../utils/platform-icons";
import {
  getConversationAssignmentLabel,
  getConversationHandlingLabel,
  getConversationHandlingState,
} from "./conversation-state";

function getPreviewText(input?: string) {
  if (!input) {
    return "New conversation";
  }

  const normalized = input.trim().toLowerCase();
  if (normalized === "[image]") return "User has sent image";
  if (normalized === "[video]") return "User has sent video";
  if (normalized === "[audio]") return "User has sent audio";
  if (normalized === "[file]") return "User has sent file";
  if (normalized === "[location]") return "User has sent location";
  if (normalized === "[contact]") return "User has sent contact";
  if (normalized === "[sticker]") return "User has sent sticker";
  if (normalized === "[emoji]") return "User has sent emoji";
  return input;
}

function ChannelIcon({ channel }: { channel: Conversation["channel"] }) {
  const iconUrl = PlatformIcons.getIconUrl(channel);

  return (
    <span
      title={channel}
      className="inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-600"
    >
      <img
        src={iconUrl}
        alt=""
        aria-hidden="true"
        className="h-3.5 w-3.5 object-contain"
      />
    </span>
  );
}

function formatTime(date?: string | Date): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return isToday
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getHandlingToneClass(handlingState: ReturnType<typeof getConversationHandlingState>) {
  if (handlingState === "expired") {
    return "text-rose-600";
  }

  if (handlingState === "paused") {
    return "text-amber-600";
  }

  if (handlingState === "pending_human") {
    return "text-sky-600";
  }

  return "text-slate-500";
}

function getHandlingIcon(handlingState: ReturnType<typeof getConversationHandlingState>) {
  if (handlingState === "paused") {
    return <ScheduleRoundedIcon className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  if (handlingState === "pending_human") {
    return <GroupsRoundedIcon className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  if (handlingState === "expired") {
    return <PersonOutlineRoundedIcon className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  return <SmartToyRoundedIcon className="h-3.5 w-3.5" aria-hidden="true" />;
}

export function ConversationList(props: {
  conversations: Conversation[];
  selectedConversationId?: string;
  currentUserId?: string | null;
  onSelect: (conversation: Conversation) => void;
}) {
  if (!props.conversations.length) {
    return (
      <div className="px-4 py-8 text-center text-sm text-slate-400">
        No conversations found.
      </div>
    );
  }

  return (
    <div>
      {props.conversations.map((conversation) => {
        const isSelected = props.selectedConversationId === conversation._id;
        const unreadCount = conversation.unreadCount ?? 0;
        const initials = (conversation.contactName || "?")[0].toUpperCase();
        const avatarUrl =
          conversation.contact?.channelIdentities?.find(
            (identity) =>
              identity.channel === conversation.channel &&
              typeof identity.avatar === "string" &&
              identity.avatar.trim().length > 0
          )?.avatar ??
          conversation.contact?.channelIdentities?.find(
            (identity) =>
              typeof identity.avatar === "string" &&
              identity.avatar.trim().length > 0
          )?.avatar;

        const platforms = Array.from(
          new Set([
            conversation.channel,
            ...(conversation.contact?.channelIdentities?.map(
              (identity) => identity.channel
            ) ?? []),
          ])
        );

        const handlingState = getConversationHandlingState(conversation);
        const handlingLabel = getConversationHandlingLabel(conversation);
        const assignmentLabel = getConversationAssignmentLabel(
          conversation,
          props.currentUserId
        );

        return (
          <button
            key={conversation._id}
            type="button"
            onClick={() => props.onSelect(conversation)}
            className={[
              "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
              isSelected ? "bg-slate-100" : "hover:bg-slate-50",
            ].join(" ")}
          >
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
              {initials}
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={conversation.contactName || "Contact avatar"}
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center gap-1">
                {platforms.map((platform) => (
                  <ChannelIcon key={`${conversation._id}-${platform}`} channel={platform} />
                ))}
              </div>

              <div className="flex items-baseline justify-between gap-1">
                <span
                  className={`truncate text-sm ${
                    unreadCount > 0
                      ? "font-semibold text-slate-900"
                      : "font-medium text-slate-700"
                  }`}
                >
                  {conversation.contactName || "Unknown"}
                </span>
                <span className="shrink-0 text-[11px] text-slate-400">
                  {formatTime(conversation.lastMessageAt)}
                </span>
              </div>

              <div className="mt-0.5 flex items-center justify-between gap-1">
                <p className="truncate text-xs text-slate-500">
                  {getPreviewText(conversation.lastMessageText)}
                </p>
                {unreadCount > 0 ? (
                  <span className="ml-1 flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold leading-none text-white">
                    {unreadCount}
                  </span>
                ) : null}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                <span
                  className={[
                    "inline-flex items-center gap-1 font-medium",
                    getHandlingToneClass(handlingState),
                  ].join(" ")}
                >
                  {getHandlingIcon(handlingState)}
                  {handlingLabel}
                </span>
                {assignmentLabel ? (
                  <span className="truncate text-slate-400">{assignmentLabel}</span>
                ) : null}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
