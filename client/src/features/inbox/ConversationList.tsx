import { Conversation } from "../../types/models";
import { ChannelBadge } from "./ChannelBadge";

function ConversationStatusBadge({ status }: { status: Conversation["status"] }) {
  const className =
    status === "open"
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : status === "pending"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-emerald-50 text-emerald-700 ring-emerald-200";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ${className}`}
    >
      {status}
    </span>
  );
}

export function ConversationList(props: {
  conversations: Conversation[];
  selectedConversationId?: string;
  onSelect: (conversationId: string) => void;
}) {
  if (!props.conversations.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        No conversations found.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {props.conversations.map((conversation) => {
        const isSelected = props.selectedConversationId === conversation._id;
        const unreadCount = conversation.unreadCount ?? 0;

        return (
          <button
            key={conversation._id}
            type="button"
            onClick={() => props.onSelect(conversation._id)}
            className={[
              "block w-full rounded-2xl border p-4 text-left transition",
              "focus:outline-none focus:ring-2 focus:ring-slate-300",
              isSelected
                ? "border-slate-900 bg-slate-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ChannelBadge channel={conversation.channel} />

                  {unreadCount > 0 ? (
                    <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
                      {unreadCount} unread
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                      No unread
                    </span>
                  )}
                </div>

                <h3 className="mt-3 truncate text-sm font-semibold text-slate-900">
                  {conversation.contactName || "Unknown contact"}
                </h3>

                <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                  {conversation.lastMessageText || "New conversation"}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-xs text-slate-500">
                  {conversation.lastMessageAt
                    ? new Date(conversation.lastMessageAt).toLocaleString()
                    : "Waiting"}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <ConversationStatusBadge status={conversation.status} />

              {isSelected ? (
                <span className="text-xs font-medium text-slate-700">Selected</span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}