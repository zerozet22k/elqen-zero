import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "../hooks/use-session";
import { apiRequest } from "../services/api";
import { connectWorkspaceSocket } from "../services/realtime";
import {
  ChannelConnection,
  Contact,
  Conversation,
  ConversationStatus,
  Message,
} from "../types/models";
import { Composer } from "../features/inbox/Composer";
import { ContactPanel } from "../features/inbox/ContactPanel";
import { ConversationList } from "../features/inbox/ConversationList";
import { ThreadView } from "../features/inbox/ThreadView";
import { FilterChip } from "../features/ui/FilterChip";
import { StatusBadge } from "../features/ui/StatusBadge";
import { Select } from "../features/ui/Select";

const statusOptions: Array<ConversationStatus | "all"> = [
  "all",
  "open",
  "pending",
  "resolved",
];

const conversationStatusOptions: Array<{
  value: ConversationStatus;
  label: string;
}> = [
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
];

function getConnectionTone(status?: string) {
  switch (status) {
    case "active":
    case "verified":
    case "connected":
      return "emerald";
    case "pending":
      return "amber";
    case "failed":
    case "error":
      return "rose";
    default:
      return "default";
  }
}

function sortConversationsByLatest(items: Conversation[]) {
  return [...items].sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });
}

function sortMessagesByTime(items: Message[]) {
  return [...items].sort((a, b) => {
    const aTime =
      "createdAt" in a && a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime =
      "createdAt" in b && b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });
}

export function InboxPage() {
  const { session } = useSession();
  const workspaceId = session?.workspace?._id;

  const [status, setStatus] = useState<ConversationStatus | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);
  const [connections, setConnections] = useState<ChannelConnection[]>([]);

  const [isBooting, setIsBooting] = useState(true);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [pageError, setPageError] = useState<string | null>(null);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  const selectedConversation = useMemo(
    () =>
      conversations.find((item) => item._id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const selectedConnection = useMemo(
    () =>
      connections.find(
        (item) =>
          item.channel === selectedConversation?.channel &&
          item.externalAccountId === selectedConversation?.channelAccountId
      ) ?? null,
    [connections, selectedConversation]
  );

  const loadConversations = useCallback(async () => {
    if (!workspaceId) return;

    const response = await apiRequest<{ items: Conversation[] }>(
      "/api/conversations",
      {},
      {
        workspaceId,
        status: status === "all" ? undefined : status,
        search: search || undefined,
      }
    );

    setConversations(sortConversationsByLatest(response.items));
  }, [workspaceId, status, search]);

  const loadConnections = useCallback(async () => {
    if (!workspaceId) return;

    const response = await apiRequest<{ items: ChannelConnection[] }>(
      "/api/channels",
      {},
      { workspaceId }
    );

    setConnections(response.items);
  }, [workspaceId]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const response = await apiRequest<{ items: Message[] }>(
      `/api/conversations/${conversationId}/messages`
    );

    setMessages(sortMessagesByTime(response.items));
  }, []);

  const loadContact = useCallback(async (contactId?: string) => {
    if (!contactId) {
      setContact(null);
      return;
    }

    const response = await apiRequest<{ contact: Contact }>(
      `/api/contacts/${contactId}`
    );
    setContact(response.contact);
  }, []);

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;

    async function boot() {
      try {
        setIsBooting(true);
        setIsLoadingConversations(true);
        setPageError(null);

        const [conversationResponse, connectionResponse] = await Promise.all([
          apiRequest<{ items: Conversation[] }>(
            "/api/conversations",
            {},
            {
              workspaceId,
              status: status === "all" ? undefined : status,
              search: search || undefined,
            }
          ),
          apiRequest<{ items: ChannelConnection[] }>(
            "/api/channels",
            {},
            { workspaceId }
          ),
        ]);

        if (cancelled) return;

        setConversations(sortConversationsByLatest(conversationResponse.items));
        setConnections(connectionResponse.items);
      } catch (error) {
        if (!cancelled) {
          setPageError(
            error instanceof Error ? error.message : "Failed to load inbox data."
          );
        }
      } finally {
        if (!cancelled) {
          setIsBooting(false);
          setIsLoadingConversations(false);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, status, search]);

  useEffect(() => {
    if (!selectedConversationId && conversations[0]) {
      setSelectedConversationId(conversations[0]._id);
      return;
    }

    if (
      selectedConversationId &&
      !conversations.some((item) => item._id === selectedConversationId)
    ) {
      setSelectedConversationId(conversations[0]?._id ?? "");
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      setContact(null);
      return;
    }

    let cancelled = false;

    async function loadThreadData() {
      try {
        setIsLoadingThread(true);
        setPageError(null);

        await Promise.all([
          loadMessages(selectedConversationId),
          loadContact(selectedConversation?.contactId),
        ]);
      } catch (error) {
        if (!cancelled) {
          setPageError(
            error instanceof Error ? error.message : "Failed to load conversation."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingThread(false);
        }
      }
    }

    void loadThreadData();

    return () => {
      cancelled = true;
    };
  }, [selectedConversationId, selectedConversation?.contactId, loadMessages, loadContact]);

  useEffect(() => {
    if (!workspaceId) return;

    const socket = connectWorkspaceSocket(workspaceId);

    const refreshConversations = () => {
      void loadConversations();
    };

    const refreshConnections = () => {
      void loadConnections();
    };

    const refreshThread = (payload: unknown) => {
      const conversationId =
        typeof payload === "object" &&
        payload &&
        "conversationId" in payload &&
        typeof (payload as { conversationId?: unknown }).conversationId === "string"
          ? (payload as { conversationId: string }).conversationId
          : null;

      void loadConversations();

      if (conversationId && conversationId === selectedConversationId) {
        void loadMessages(conversationId);
      }
    };

    socket.on("conversation.created", refreshConversations);
    socket.on("conversation.updated", refreshConversations);
    socket.on("message.received", refreshThread);
    socket.on("message.sent", refreshThread);
    socket.on("message.failed", refreshThread);
    socket.on("connection.updated", refreshConnections);

    return () => {
      socket.off("conversation.created", refreshConversations);
      socket.off("conversation.updated", refreshConversations);
      socket.off("message.received", refreshThread);
      socket.off("message.sent", refreshThread);
      socket.off("message.failed", refreshThread);
      socket.off("connection.updated", refreshConnections);
      socket.disconnect();
    };
  }, [
    loadConnections,
    loadConversations,
    loadMessages,
    selectedConversationId,
    workspaceId,
  ]);

  const handleSend = async (text: string) => {
    if (!selectedConversationId) return;

    setSendError("");

    try {
      setIsSending(true);

      await apiRequest(`/api/conversations/${selectedConversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          senderType: "agent",
          kind: "text",
          text: { body: text },
        }),
      });

      await Promise.all([
        loadMessages(selectedConversationId),
        loadConversations(),
        loadConnections(),
      ]);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Send failed.");
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusUpdate = async (nextStatus: ConversationStatus) => {
    if (!selectedConversationId) return;

    try {
      setIsUpdatingStatus(true);
      setPageError(null);

      await apiRequest(`/api/conversations/${selectedConversationId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: nextStatus,
        }),
      });

      await loadConversations();
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Failed to update conversation status."
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const composerDisabledReason = !selectedConversation
    ? "Select a conversation to send a reply."
    : !selectedConnection
      ? "No stored channel connection matches this conversation."
      : selectedConnection.status !== "active"
        ? selectedConnection.lastError ||
          `Connection is ${selectedConnection.status}. Sending is blocked until the provider setup is active.`
        : undefined;

  const openCount = conversations.filter((item) => item.status === "open").length;
  const pendingCount = conversations.filter((item) => item.status === "pending").length;
  const resolvedCount = conversations.filter((item) => item.status === "resolved").length;
  const unreadCount = conversations.reduce((sum, item) => sum + item.unreadCount, 0);

  if (!workspaceId) {
    return (
      <div className="h-[100dvh] p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No workspace session found.
        </div>
      </div>
    );
  }

  if (isBooting) {
    return (
      <div className="h-[100dvh] overflow-hidden p-6">
        <div className="flex h-full min-h-0 flex-col space-y-6">
          <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-6">
            <div className="h-4 w-28 rounded bg-slate-200" />
            <div className="mt-3 h-8 w-56 rounded bg-slate-200" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-3xl border border-slate-200 bg-white"
              />
            ))}
          </div>

          <div className="grid flex-1 min-h-0 gap-6 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
            <div className="h-full min-h-0 animate-pulse rounded-3xl border border-slate-200 bg-white" />
            <div className="h-full min-h-0 animate-pulse rounded-3xl border border-slate-200 bg-white" />
            <div className="h-full min-h-0 animate-pulse rounded-3xl border border-slate-200 bg-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] min-w-0 overflow-hidden bg-slate-50 p-6">
      <div className="flex h-full min-h-0 flex-col space-y-6">
        <header className="shrink-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Unified Inbox
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                Conversations
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Manage active threads, update statuses, and respond from one workspace view.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[540px]">
              <input
                placeholder="Search preview text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />

              <div className="flex flex-wrap gap-2">
                {statusOptions.map((option) => (
                  <FilterChip
                    key={option}
                    active={status === option}
                    label={option}
                    onClick={() => setStatus(option)}
                  />
                ))}
              </div>
            </div>
          </div>
        </header>

        {pageError ? (
          <div className="shrink-0 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {pageError}
          </div>
        ) : null}

        <section className="shrink-0 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Unread
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {unreadCount}
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Open
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {openCount}
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Pending
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {pendingCount}
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Resolved
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {resolvedCount}
            </p>
          </article>
        </section>

        <section className="grid flex-1 min-h-0 gap-6 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
          <div className="h-full min-h-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3 px-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Inbox list
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  Conversations
                </h3>
              </div>

              {isLoadingConversations ? (
                <StatusBadge label="Refreshing" tone="blue" />
              ) : (
                <StatusBadge label={`${conversations.length} threads`} />
              )}
            </div>

            <div className="min-h-0 h-[calc(100%-64px)] overflow-y-auto pr-1">
              <ConversationList
                conversations={conversations}
                onSelect={setSelectedConversationId}
                selectedConversationId={selectedConversationId}
              />
            </div>
          </div>

          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="shrink-0 border-b border-slate-200 px-6 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-slate-900">
                    {selectedConversation?.contactName || "No thread selected"}
                  </h3>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {selectedConversation ? (
                      <>
                        <StatusBadge label={selectedConversation.channel} />
                        <StatusBadge label={selectedConversation.status} />
                      </>
                    ) : null}

                    {selectedConnection ? (
                      <>
                        <StatusBadge
                          label={selectedConnection.status}
                          tone={getConnectionTone(selectedConnection.status)}
                        />
                        <StatusBadge label={selectedConnection.verificationState} />
                      </>
                    ) : (
                      <StatusBadge label="No linked connection" tone="rose" />
                    )}
                  </div>

                  <p className="mt-3 text-sm text-slate-500">
                    {selectedConnection
                      ? `${selectedConnection.channel} connection is ${selectedConnection.status}.`
                      : "No live channel connection is linked to this thread."}
                  </p>
                </div>

                {selectedConversation ? (
                  <Select<ConversationStatus>
                    value={selectedConversation.status}
                    onChange={(value) => void handleStatusUpdate(value)}
                    disabled={isUpdatingStatus}
                    options={conversationStatusOptions}
                  />
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">
              {isLoadingThread ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-20 animate-pulse rounded-2xl bg-slate-100"
                    />
                  ))}
                </div>
              ) : (
                <ThreadView messages={messages} />
              )}
            </div>

            <div className="shrink-0 border-t border-slate-200 px-6 py-4">
              <Composer
                disabled={isSending || !selectedConversationId || !!composerDisabledReason}
                disabledReason={composerDisabledReason}
                error={sendError}
                onSend={handleSend}
              />
            </div>
          </div>

          <div className="h-full min-h-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 px-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Contact context
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">
                Details
              </h3>
            </div>

            <div className="min-h-0 h-[calc(100%-64px)] overflow-auto">
              <ContactPanel contact={contact} conversation={selectedConversation} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}