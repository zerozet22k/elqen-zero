import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../hooks/use-session";
import { apiRequest } from "../services/api";
import { connectWorkspaceSocket } from "../services/realtime";
import {
  INBOUND_NOTIFICATION_SOUND_DATA_URI,
  shouldPlayInboundNotification,
  type MessageReceivedRealtimePayload,
} from "../utils/inbound-notification";
import {
  AISettings,
  CannedReply,
  ChannelConnection,
  Contact,
  Conversation,
  ConversationPresenceEntry,
  ConversationStatus,
  Message,
  MessageKind,
} from "../types/models";
import { OutboundContentBlock } from "../types/outbound-content";
import { Composer, ComposerSendPayload } from "../features/inbox/Composer";
import { ContactPanel } from "../features/inbox/ContactPanel";
import { ConversationList } from "../features/inbox/ConversationList";
import {
  getComposerDisabledReason,
  isConnectionUsableForSending,
  shouldPersistSendError,
} from "../features/inbox/inbox-state";
import { StickerCatalog } from "../features/inbox/sticker-catalog";
import { ThreadView } from "../features/inbox/ThreadView";
import { ToastItem, ToastStack } from "../features/ui/ToastStack";

type StatusFilter = ConversationStatus | "all";
type ManagementFilter =
  | "all"
  | "assigned_to_me"
  | "staff_managed"
  | "bot_managed";

const statusOptions: StatusFilter[] = [
  "all",
  "open",
  "pending",
  "resolved",
];

const managementOptions: ManagementFilter[] = [
  "all",
  "assigned_to_me",
  "staff_managed",
  "bot_managed",
];

const defaultSupportedChannels: Record<Conversation["channel"], boolean> = {
  facebook: true,
  telegram: true,
  viber: true,
  tiktok: true,
};

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

function isConversationStatus(value: StatusFilter): value is ConversationStatus {
  return value === "open" || value === "pending" || value === "resolved";
}

function getStatusFilterLabel(value: StatusFilter) {
  if (value === "all") return "All";
  if (value === "open") return "Open";
  if (value === "pending") return "Pending";
  if (value === "resolved") return "Resolved";
  return value;
}

function getChannelIconSrc(channel: Conversation["channel"]) {
  return `/platform-icons/${channel}.svg`;
}

function getActivityTone(aiState?: Conversation["aiState"]) {
  if (aiState === "human_active") {
    return "bg-sky-50 text-sky-700";
  }

  if (aiState === "needs_human" || aiState === "human_requested") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
}

function getActivityIcon(aiState?: Conversation["aiState"]) {
  if (aiState === "human_active") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5" aria-hidden="true">
        <circle cx="12" cy="8" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 19a6 6 0 0 1 12 0" />
      </svg>
    );
  }

  if (aiState === "needs_human" || aiState === "human_requested") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.5 9.5 3.5 3.5 3.5-3.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
      </svg>
    );
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="7" y="3.5" width="10" height="7" rx="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v3" />
      <rect x="5" y="14" width="14" height="6.5" rx="2" />
    </svg>
  );
}

function getManagementFilterLabel(value: ManagementFilter) {
  if (value === "all") return "All Ownership";
  if (value === "assigned_to_me") return "Assigned to Me";
  if (value === "staff_managed") return "Staff Managed";
  if (value === "bot_managed") return "Bot Managed";
  return value;
}

function getManagementFilterShortLabel(value: ManagementFilter) {
  if (value === "all") return "All";
  if (value === "assigned_to_me") return "Mine";
  if (value === "staff_managed") return "Staff";
  if (value === "bot_managed") return "Bot";
  return value;
}

function renderManagementFilterIcon(value: ManagementFilter) {
  if (value === "all") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16" />
      </svg>
    );
  }

  if (value === "assigned_to_me") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 19a6 6 0 0 1 12 0" />
      </svg>
    );
  }

  if (value === "staff_managed") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <circle cx="9" cy="9" r="2.5" />
        <circle cx="15.5" cy="10.5" r="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 18a4.5 4.5 0 0 1 9 0" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <rect x="7" y="3.5" width="10" height="7" rx="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v3" />
      <rect x="5" y="14" width="14" height="6.5" rx="2" />
    </svg>
  );
}

function applySidebarConversationFilter(
  items: Conversation[],
  statusFilter: StatusFilter,
  managementFilter: ManagementFilter,
  currentUserId?: string | null
) {
  const filtered = items.filter((item) => {
    const assigneeId = item.assignee?._id ?? item.assigneeUserId ?? null;

    const matchesStatus =
      statusFilter === "all" ? true : item.status === statusFilter;

    const matchesManagement =
      managementFilter === "all"
        ? true
        : managementFilter === "assigned_to_me"
          ? !!currentUserId && assigneeId === currentUserId
          : managementFilter === "staff_managed"
            ? !!assigneeId
            : !assigneeId;

    if (!matchesStatus || !matchesManagement) {
      return false;
    }

    if (managementFilter === "assigned_to_me") {
      return !!currentUserId && assigneeId === currentUserId;
    }

    if (managementFilter === "staff_managed") {
      return !!assigneeId;
    }

    if (managementFilter === "bot_managed") {
      return !assigneeId;
    }

    return true;
  });

  return sortConversationsByLatest(filtered);
}

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read attachment"));
        return;
      }
      const split = result.split(",");
      resolve(split[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Failed to read attachment"));
    reader.readAsDataURL(file);
  });

const inferOutboundKind = (file: File): Extract<MessageKind, "image" | "video" | "file"> => {
  const mimeType = file.type.toLowerCase();
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  return "file";
};

const validateTikTokAttachment = (file: File) => {
  const mimeType = file.type.toLowerCase();
  const isJpeg = mimeType === "image/jpeg" || mimeType === "image/jpg";
  const isPng = mimeType === "image/png";

  if (!isJpeg && !isPng) {
    throw new Error("TikTok direct messages currently support JPG and PNG image uploads only.");
  }

  if (file.size > 3 * 1024 * 1024) {
    throw new Error("TikTok direct messages limit image uploads to 3 MB.");
  }
};

type OutboundDeliverySummary = {
  status?: string;
  error?: string | null;
} | null;

type SendConversationMessageResponse = {
  message?: Message | null;
  messages?: Message[];
  delivery?: OutboundDeliverySummary;
  deliveries?: OutboundDeliverySummary[];
};

function getFailedDeliveryMessage(response: SendConversationMessageResponse) {
  const collectedDeliveries: OutboundDeliverySummary[] = [
    ...(Array.isArray(response.deliveries) ? response.deliveries : []),
    response.delivery ?? null,
    ...(Array.isArray(response.messages)
      ? response.messages.map((message) => message.delivery ?? null)
      : []),
    response.message?.delivery ?? null,
  ];

  const failedDelivery = collectedDeliveries.find(
    (delivery) => delivery?.status === "failed"
  );

  if (!failedDelivery) {
    return null;
  }

  return (
    failedDelivery.error?.trim() ||
    "The provider accepted the send request, but delivery failed."
  );
}

export function InboxPage() {
  const { session, activeWorkspace } = useSession();
  const workspaceId = activeWorkspace?._id;
  const currentUserId = session?.user?._id ?? null;

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [managementFilter, setManagementFilter] = useState<ManagementFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");

  const [contact, setContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([]);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(true);
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  const [conversationPresence, setConversationPresence] = useState<
    Record<string, ConversationPresenceEntry[]>
  >({});

  const [isBooting, setIsBooting] = useState(true);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeletingChatUser, setIsDeletingChatUser] = useState(false);

  const [pageError, setPageError] = useState<string | null>(null);
  const [sendError, setSendError] = useState("");
  const [stickerCatalog, setStickerCatalog] = useState<StickerCatalog | null>(null);
  const [stickerCatalogError, setStickerCatalogError] = useState<string | null>(null);
  const [isLoadingStickerCatalog, setIsLoadingStickerCatalog] = useState(false);
  const [supportedChannels, setSupportedChannels] = useState<
    Record<Conversation["channel"], boolean>
  >(defaultSupportedChannels);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notificationsMuted, setNotificationsMuted] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("omni-chat-notifications-muted") === "true";
  });

  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const playedInboundMessageIdsRef = useRef<Set<string>>(new Set());
  const workspaceSocketRef = useRef<ReturnType<typeof connectWorkspaceSocket> | null>(null);
  const selectedConversationIdRef = useRef("");
  const conversationsRef = useRef<Conversation[]>([]);

  const pushToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const next: ToastItem = {
      ...toast,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    setToasts((current) => [...current.slice(-3), next]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    notificationAudioRef.current = new Audio(INBOUND_NOTIFICATION_SOUND_DATA_URI);
    notificationAudioRef.current.preload = "auto";
    notificationAudioRef.current.volume = 0.45;
    return () => {
      notificationAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      "omni-chat-notifications-muted",
      notificationsMuted ? "true" : "false"
    );
  }, [notificationsMuted]);

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
  const selectedConversationPresence =
    conversationPresence[selectedConversation?._id ?? ""] ?? [];
  const visibleViewers = selectedConversationPresence;
  const activeComposers = selectedConversationPresence.filter((entry) => entry.isComposing);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const loadConversations = useCallback(async () => {
    if (!workspaceId) return;

    const response = await apiRequest<{ items: Conversation[] }>(
      "/api/conversations",
      {},
      {
        workspaceId,
        status: isConversationStatus(statusFilter) ? statusFilter : undefined,
        assigneeUserId:
          managementFilter === "assigned_to_me" ? currentUserId ?? undefined : undefined,
        search: search || undefined,
      }
    );

    setConversations(
      applySidebarConversationFilter(
        response.items,
        statusFilter,
        managementFilter,
        currentUserId
      )
    );
  }, [workspaceId, statusFilter, managementFilter, currentUserId, search]);

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
        setPageError(null);

        const [conversationResponse, connectionResponse, settingsResponse] =
          await Promise.all([
          apiRequest<{ items: Conversation[] }>(
            "/api/conversations",
            {},
            {
              workspaceId,
              status: isConversationStatus(statusFilter) ? statusFilter : undefined,
              assigneeUserId:
                managementFilter === "assigned_to_me"
                  ? currentUserId ?? undefined
                  : undefined,
              search: search || undefined,
            }
          ),
          apiRequest<{ items: ChannelConnection[] }>(
            "/api/channels",
            {},
            { workspaceId }
          ),
          apiRequest<{ settings: AISettings | null }>(
            "/api/ai-settings",
            {},
            { workspaceId }
          ),
        ]);

        if (cancelled) return;

        setConversations(
          applySidebarConversationFilter(
            conversationResponse.items,
            statusFilter,
            managementFilter,
            currentUserId
          )
        );
        setConnections(connectionResponse.items);
        setSupportedChannels(
          settingsResponse.settings?.supportedChannels ?? defaultSupportedChannels
        );
      } catch (error) {
        if (!cancelled) {
          setPageError(
            error instanceof Error ? error.message : "Failed to load inbox data."
          );
        }
      } finally {
        if (!cancelled) {
          setIsBooting(false);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, statusFilter, managementFilter, currentUserId, search]);

  useEffect(() => {
    if (!workspaceId) {
      setCannedReplies([]);
      return;
    }

    let cancelled = false;

    async function bootCannedReplies() {
      try {
        const response = await apiRequest<{ items: CannedReply[] }>(
          "/api/canned-replies",
          {},
          { workspaceId }
        );

        if (!cancelled) {
          setCannedReplies(response.items.filter((item) => item.isActive !== false));
        }
      } catch {
        if (!cancelled) {
          setCannedReplies([]);
        }
      }
    }

    void bootCannedReplies();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

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
    const channel = selectedConversation?.channel;
    if (!selectedConversationId || !channel) {
      setStickerCatalog(null);
      setStickerCatalogError(null);
      setIsLoadingStickerCatalog(false);
      return;
    }

    const stickerChannel = channel;

    if (stickerChannel !== "telegram" && stickerChannel !== "viber") {
      setStickerCatalog({
        channel: stickerChannel,
        supported: false,
        items: [],
      });
      setStickerCatalogError(null);
      setIsLoadingStickerCatalog(false);
      return;
    }

    let cancelled = false;

    async function loadStickerCatalog() {
      try {
        setIsLoadingStickerCatalog(true);
        setStickerCatalogError(null);
        setStickerCatalog({
          channel: stickerChannel,
          supported: true,
          items: [],
        });

        const response = await apiRequest<{ catalog: StickerCatalog }>(
          `/api/conversations/${selectedConversationId}/sticker-catalog`
        );

        if (cancelled) {
          return;
        }

        setStickerCatalog(response.catalog);
      } catch (error) {
        if (!cancelled) {
          setStickerCatalog({
            channel: stickerChannel,
            supported: true,
            items: [],
          });
          setStickerCatalogError(
            error instanceof Error ? error.message : "Failed to load sticker catalog."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingStickerCatalog(false);
        }
      }
    }

    void loadStickerCatalog();

    return () => {
      cancelled = true;
    };
  }, [selectedConversation?.channel, selectedConversationId]);

  useEffect(() => {
    if (!workspaceId) return;

    const socket = connectWorkspaceSocket(workspaceId, {
      userId: session?.user?._id ?? null,
      userName: session?.user?.name ?? null,
    });
    workspaceSocketRef.current = socket;

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

      if (conversationId && conversationId === selectedConversationIdRef.current) {
        void loadMessages(conversationId);
      }
    };

    const onMessageReceived = (payload: unknown) => {
      refreshThread(payload);

      const normalized =
        typeof payload === "object" && payload
          ? (payload as MessageReceivedRealtimePayload)
          : {};

      const conversationId = normalized.conversationId?.trim();

      if (conversationId && conversationId === selectedConversationIdRef.current) {
        setConversations((current) =>
          current.map((item) =>
            item._id === conversationId ? { ...item, unreadCount: 0 } : item
          )
        );
        void apiRequest(`/api/conversations/${conversationId}`, {
          method: "PATCH",
          body: JSON.stringify({ unreadCount: 0 }),
        }).catch(() => {
          // Non-critical — UI already reflects read state.
        });
      }

      if (!shouldPlayInboundNotification(normalized, playedInboundMessageIdsRef.current)) {
        return;
      }

      const relatedConversation = conversationId
        ? conversationsRef.current.find((item) => item._id === conversationId)
        : null;

      const assigneeId = relatedConversation?.assignee?._id;
      const currentUserId = session?.user?._id;
      const isManagedByAnotherStaff =
        !!assigneeId && !!currentUserId && assigneeId !== currentUserId;

      if (isManagedByAnotherStaff) {
        return;
      }

      const messageId = normalized.messageId?.trim();
      if (!messageId) {
        return;
      }

      playedInboundMessageIdsRef.current.add(messageId);

      const contactName =
        relatedConversation?.contactName?.trim() || "customer";
      pushToast({
        title: `New message from ${contactName}`,
        description:
          relatedConversation?.assignee?.name && currentUserId
            ? relatedConversation.assignee._id === currentUserId
              ? "This chat is managed by you"
              : `Managed by ${relatedConversation.assignee.name}`
            : "Unassigned chat",
        tone: "info",
      });

      if (notificationsMuted) {
        return;
      }

      const audio = notificationAudioRef.current;
      if (!audio) {
        return;
      }

      audio.currentTime = 0;
      void audio.play().catch(() => {
        // Browser autoplay policies can block audio without prior user interaction.
      });
    };

    socket.on("conversation.created", refreshConversations);
    socket.on("conversation.updated", refreshConversations);
    socket.on("message.received", onMessageReceived);
    socket.on("message.sent", refreshThread);
    socket.on("message.failed", refreshThread);
    socket.on("connection.updated", refreshConnections);
    socket.on("contact.updated", (payload: unknown) => {
      const normalized =
        typeof payload === "object" && payload
          ? (payload as { contactId?: string; contact?: Contact })
          : {};

      const nextContactId = normalized.contactId?.trim();
      const nextContact = normalized.contact;
      if (!nextContactId || !nextContact || typeof nextContact !== "object") {
        return;
      }

      setContact((current) =>
        current && current._id === nextContactId ? nextContact : current
      );
    });
    socket.on("presence.updated", (payload: unknown) => {
      const normalized =
        typeof payload === "object" && payload
          ? (payload as {
              conversationId?: string;
              viewers?: ConversationPresenceEntry[];
            })
          : {};

      const conversationId = normalized.conversationId?.trim();
      if (!conversationId) {
        return;
      }

      setConversationPresence((current) => ({
        ...current,
        [conversationId]: Array.isArray(normalized.viewers) ? normalized.viewers : [],
      }));
    });

    return () => {
      workspaceSocketRef.current = null;
      socket.off("conversation.created", refreshConversations);
      socket.off("conversation.updated", refreshConversations);
      socket.off("message.received", onMessageReceived);
      socket.off("message.sent", refreshThread);
      socket.off("message.failed", refreshThread);
      socket.off("connection.updated", refreshConnections);
      socket.off("contact.updated");
      socket.off("presence.updated");
      socket.disconnect();
    };
  }, [
    loadConnections,
    loadConversations,
    loadMessages,
    notificationsMuted,
    pushToast,
    session?.user?._id,
    session?.user?.name,
    workspaceId,
  ]);

  useEffect(() => {
    const socket = workspaceSocketRef.current;
    if (!socket) {
      return;
    }

    socket.emit("conversation.view", {
      conversationId: selectedConversationId || null,
    });

    return () => {
      socket.emit("conversation.compose", {
        conversationId: selectedConversationId || null,
        active: false,
      });
    };
  }, [selectedConversationId]);

  useEffect(() => {
    setSendError("");
  }, [selectedConversationId]);

  const refreshAfterSend = useCallback(async () => {
    if (!selectedConversationId) {
      return;
    }

    await Promise.all([
      loadMessages(selectedConversationId),
      loadConversations(),
      loadConnections(),
    ]);
  }, [loadConnections, loadConversations, loadMessages, selectedConversationId]);

  const finalizeSendResponse = useCallback(
    async (response: SendConversationMessageResponse, successTitle: string) => {
      await refreshAfterSend();

      const failedDeliveryMessage = getFailedDeliveryMessage(response);
      if (failedDeliveryMessage) {
        if (shouldPersistSendError({ message: failedDeliveryMessage, selectedConnection })) {
          setSendError(failedDeliveryMessage);
        } else {
          setSendError("");
        }

        pushToast({
          title: "Delivery needs attention",
          description: failedDeliveryMessage,
          tone: "warn",
        });
        return;
      }

      setSendError("");
      pushToast({
        title: successTitle,
        tone: "success",
      });
    },
    [pushToast, refreshAfterSend, selectedConnection]
  );

  const handleSend = async ({ text, attachment }: ComposerSendPayload) => {
    if (!selectedConversationId) return;
    if (selectedConversation && supportedChannels[selectedConversation.channel] === false) {
      const message = `${selectedConversation.channel} is disabled in AI Settings.`;
      setSendError(message);
      pushToast({
        title: "Send blocked",
        description: message,
        tone: "warn",
      });
      return;
    }

    setSendError("");

    try {
      setIsSending(true);

      const sendBlocks = async (blocks: OutboundContentBlock[]) => {
        const response = await apiRequest<SendConversationMessageResponse>(
          `/api/conversations/${selectedConversationId}/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              senderType: "agent",
              blocks,
            }),
          }
        );

        await finalizeSendResponse(response, "Message sent");
      };

      const stickerCommandMatch = text.trim().match(/^\/sticker\s+(.+)$/i);
      if (
        !attachment &&
        stickerCommandMatch &&
        (selectedConversation?.channel === "telegram" ||
          selectedConversation?.channel === "viber")
      ) {
        const platformStickerId = stickerCommandMatch[1].trim();
        await sendBlocks([
          {
            kind: "sticker",
            channel: selectedConversation?.channel ?? undefined,
            sticker: {
              platformStickerId,
            },
          },
        ]);
        return;
      }

      if (attachment) {
        if (selectedConversation?.channel === "tiktok") {
          validateTikTokAttachment(attachment);
        }

        const dataBase64 = await readFileAsBase64(attachment);
        const uploadResponse = await apiRequest<{
          asset: {
            _id: string;
            url: string;
            mimeType: string;
            size: number;
            fileName: string;
          };
        }>("/api/media-assets", {
          method: "POST",
          body: JSON.stringify({
            fileName: attachment.name,
            mimeType: attachment.type || "application/octet-stream",
            dataBase64,
          }),
        });

        const kind = inferOutboundKind(attachment);
        const attachmentBlock: OutboundContentBlock = {
          kind: "attachment",
          attachment: {
            kind,
            text:
              selectedConversation?.channel === "tiktok"
                ? undefined
                : text
                  ? {
                      body: text,
                      plain: text,
                    }
                  : undefined,
            media: [
              {
                url: uploadResponse.asset.url,
                storedAssetId: uploadResponse.asset._id,
                storedAssetUrl: uploadResponse.asset.url,
                mimeType: uploadResponse.asset.mimeType,
                filename: uploadResponse.asset.fileName,
                size: uploadResponse.asset.size,
                isTemporary: false,
              },
            ],
          },
        };

        if (selectedConversation?.channel === "tiktok" && text) {
          await sendBlocks([
            {
              kind: "text",
              text: {
                body: text,
                plain: text,
              },
            },
            attachmentBlock,
          ]);
        } else {
          await sendBlocks([attachmentBlock]);
        }
      } else {
        await sendBlocks([
          {
            kind: "text",
            text: {
              body: text,
              plain: text,
            },
          },
        ]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Send failed.";
      if (shouldPersistSendError({ message, selectedConnection })) {
        setSendError(message);
      } else {
        setSendError("");
      }
      pushToast({
        title: "Send failed",
        description: message,
        tone: "warn",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendSticker = useCallback(
    async (platformStickerId: string) => {
      if (!selectedConversationId) {
        return;
      }

      const normalizedStickerId = platformStickerId.trim();
      if (
        selectedConversation?.channel === "telegram" &&
        /^AgAD[A-Za-z0-9_-]+$/.test(normalizedStickerId)
      ) {
        const message =
          "Telegram rejected this sticker identifier. Use sticker file_id (usually starts with CAAC), not file_unique_id (starts with AgAD).";
        if (shouldPersistSendError({ message, selectedConnection })) {
          setSendError(message);
        } else {
          setSendError("");
        }
        pushToast({
          title: "Invalid Telegram sticker ID",
          description: message,
          tone: "warn",
        });
        return;
      }

      if (
        selectedConversation?.channel === "telegram" &&
        !/^[A-Za-z0-9_-]{16,}$/.test(normalizedStickerId)
      ) {
        const message =
          "Telegram sticker ID looks invalid. Use a full Telegram file_id from a real sticker message.";
        if (shouldPersistSendError({ message, selectedConnection })) {
          setSendError(message);
        } else {
          setSendError("");
        }
        pushToast({
          title: "Invalid Telegram sticker ID",
          description: message,
          tone: "warn",
        });
        return;
      }

      if (
        selectedConversation &&
        supportedChannels[selectedConversation.channel] === false
      ) {
        const message = `${selectedConversation.channel} is disabled in AI Settings.`;
        setSendError(message);
        pushToast({
          title: "Send blocked",
          description: message,
          tone: "warn",
        });
        return;
      }

      setSendError("");

      try {
        setIsSending(true);

        const response = await apiRequest<SendConversationMessageResponse>(
          `/api/conversations/${selectedConversationId}/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              senderType: "agent",
              blocks: [
                {
                  kind: "sticker",
                  channel: selectedConversation?.channel ?? undefined,
                  sticker: {
                    platformStickerId: normalizedStickerId,
                  },
                },
              ],
            }),
          }
        );

        await finalizeSendResponse(response, "Sticker sent");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to send sticker.";
        if (shouldPersistSendError({ message, selectedConnection })) {
          setSendError(message);
        } else {
          setSendError("");
        }
        pushToast({
          title: "Sticker send failed",
          description: message,
          tone: "warn",
        });
      } finally {
        setIsSending(false);
      }
    },
    [
      finalizeSendResponse,
      pushToast,
      selectedConnection,
      selectedConversation?.channel,
      selectedConversation,
      selectedConversationId,
      supportedChannels,
    ]
  );

  const handleConversationUpdated = useCallback(
    (updatedConversation: Conversation) => {
      setConversations((current) =>
        sortConversationsByLatest(
          current.map((item) =>
            item._id === updatedConversation._id
              ? {
                  ...item,
                  ...updatedConversation,
                }
              : item
          )
        )
      );

      if (selectedConversationId === updatedConversation._id) {
        void loadMessages(updatedConversation._id);
      }
    },
    [loadMessages, selectedConversationId]
  );

  const handleContactUpdated = useCallback((updatedContact: Contact) => {
    setContact(updatedContact);
  }, []);

  const handleInspectorButtonClick = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1280) {
      setIsInspectorCollapsed((current) => !current);
      return;
    }

    setIsContactPanelOpen(true);
  }, []);

  const handleCollapseInspector = useCallback(() => {
    setIsInspectorCollapsed(true);
  }, []);

  const handleComposeActivityChange = useCallback((active: boolean) => {
    const socket = workspaceSocketRef.current;
    if (!socket || !selectedConversationIdRef.current) {
      return;
    }

    socket.emit("conversation.compose", {
      conversationId: selectedConversationIdRef.current,
      active,
    });
  }, []);

  const handleStatusUpdate = useCallback(
    async (nextStatus: ConversationStatus) => {
      if (!selectedConversationId || !selectedConversation) {
        return;
      }

      if (selectedConversation.status === nextStatus) {
        return;
      }

      try {
        setIsUpdatingStatus(true);
        setPageError(null);

        setConversations((current) =>
          current.map((item) =>
            item._id === selectedConversationId
              ? {
                  ...item,
                  status: nextStatus,
                }
              : item
          )
        );

        await apiRequest(`/api/conversations/${selectedConversationId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        });
      } catch (error) {
        setPageError(
          error instanceof Error
            ? error.message
            : "Failed to update conversation status."
        );
        void loadConversations();
      } finally {
        setIsUpdatingStatus(false);
      }
    },
    [selectedConversationId, selectedConversation, loadConversations]
  );

  const handleConversationSelect = useCallback(
    async (conversation: Conversation) => {
      setSelectedConversationId(conversation._id);

      if ((conversation.unreadCount ?? 0) <= 0) {
        return;
      }

      setConversations((current) =>
        current.map((item) =>
          item._id === conversation._id
            ? {
                ...item,
                unreadCount: 0,
              }
            : item
        )
      );

      try {
        await apiRequest(`/api/conversations/${conversation._id}`, {
          method: "PATCH",
          body: JSON.stringify({ unreadCount: 0 }),
        });
      } catch {
        // Keep local UI responsive even if read sync fails.
      }
    },
    []
  );

  const handleDeleteChatUser = useCallback(async () => {
    if (!selectedConversation?.contactId) {
      return;
    }

    const chatUserName = selectedConversation.contactName || "this chat user";
    const firstConfirm = window.confirm(
      `Delete ${chatUserName} and all related messages? This cannot be undone.`
    );
    if (!firstConfirm) {
      return;
    }

    const secondConfirm = window.confirm(
      "Final confirmation: permanently delete this chat user, all conversations, and all messages?"
    );
    if (!secondConfirm) {
      return;
    }

    try {
      setIsDeletingChatUser(true);
      setPageError(null);

      const response = await apiRequest<{
        deleted: boolean;
        result: {
          deletedContactId: string;
          deletedConversations: number;
          deletedMessages: number;
        };
      }>(`/api/contacts/${selectedConversation.contactId}?confirm=true`, {
        method: "DELETE",
      });

      setSelectedConversationId("");
      setMessages([]);
      setContact(null);
      setIsContactPanelOpen(false);

      await Promise.all([loadConversations(), loadConnections()]);

      pushToast({
        title: "Chat user deleted",
        description: `${response.result.deletedConversations} conversation(s), ${response.result.deletedMessages} message(s) removed.`,
        tone: "success",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to delete chat user and messages.";
      setPageError(message);
      pushToast({
        title: "Delete failed",
        description: message,
        tone: "warn",
      });
    } finally {
      setIsDeletingChatUser(false);
    }
  }, [
    loadConnections,
    loadConversations,
    pushToast,
    selectedConversation?.contactId,
    selectedConversation?.contactName,
  ]);

  const composerDisabledReason = getComposerDisabledReason({
    selectedConversation,
    selectedConnection,
    supportedChannels,
  });

  useEffect(() => {
    if (
      !sendError ||
      composerDisabledReason ||
      !selectedConversation ||
      !selectedConnection ||
      !isConnectionUsableForSending(selectedConnection)
    ) {
      return;
    }

    setSendError("");
  }, [
    composerDisabledReason,
    selectedConnection,
    selectedConversation,
    sendError,
  ]);

  const viewedByLabel = visibleViewers
    .map((entry) => (entry.userId === session?.user?._id ? "You" : entry.userName))
    .join(", ");
  const replyingByLabel = activeComposers
    .map((entry) => (entry.userId === session?.user?._id ? "You" : entry.userName))
    .join(", ");
  const activityLabel = selectedConversation
    ? selectedConversation.aiState === "human_active"
      ? selectedConversation.assignee?.name
        ? `Managed by ${selectedConversation.assignee.name}`
        : "Staff Active"
      : selectedConversation.aiState === "needs_human" ||
          selectedConversation.aiState === "human_requested"
        ? "Needs Staff"
        : "Bot Active"
    : "Bot Active";

  if (!workspaceId) {
    return (
      <div className="min-h-dvh bg-slate-100/80 p-6">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
          No workspace session found.
        </div>
      </div>
    );
  }

  if (isBooting) {
    return (
      <div className="min-h-dvh bg-slate-100/80 p-4">
        <div className="flex h-[calc(100dvh-2rem)] gap-4">
          <div className="w-[19.5rem] shrink-0 rounded-[1.75rem] border border-slate-200/90 bg-white" />
          <div className="flex flex-1 flex-col gap-4 rounded-[1.75rem] border border-slate-200/90 bg-white p-6">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
          <div className="hidden w-[22rem] shrink-0 rounded-[1.75rem] border border-slate-200/90 bg-white xl:block" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-100/80 p-4">
      <div className="flex h-[calc(100dvh-2rem)] gap-4 overflow-hidden">
        <aside className="flex w-[19.5rem] shrink-0 flex-col rounded-[1.75rem] border border-slate-200/90 bg-white shadow-[0_24px_50px_-36px_rgba(15,23,42,0.45)]">
          <div className="flex items-center justify-between px-5 pb-4 pt-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Support
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Inbox</h2>
            </div>
            <button
              type="button"
              onClick={() => setNotificationsMuted((current) => !current)}
              className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-900"
            >
              {notificationsMuted ? "Unmute" : "Mute"}
            </button>
          </div>

          <div className="px-4">
            <div className="relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
                <circle cx="11" cy="11" r="6" />
              </svg>
              <input
                placeholder="Search..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              />
            </div>
          </div>

          <div className="px-4 pt-4">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
              {statusOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatusFilter(option)}
                  className={[
                    "h-8 rounded-full px-3 text-xs font-semibold transition",
                    statusFilter === option
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:bg-white hover:text-slate-900",
                  ].join(" ")}
                  aria-pressed={statusFilter === option}
                >
                  {getStatusFilterLabel(option)}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 pb-4 pt-2">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
              {managementOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setManagementFilter(option)}
                  className={[
                    "inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition",
                    managementFilter === option
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:bg-white hover:text-slate-900",
                  ].join(" ")}
                  aria-pressed={managementFilter === option}
                  aria-label={getManagementFilterLabel(option)}
                  title={getManagementFilterLabel(option)}
                >
                  {renderManagementFilterIcon(option)}
                </button>
              ))}
            </div>
          </div>

          {pageError ? (
            <div className="mx-4 mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {pageError}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto pb-3">
            <ConversationList
              conversations={conversations}
              currentUserId={session?.user?._id ?? null}
              onSelect={handleConversationSelect}
              selectedConversationId={selectedConversationId}
            />
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col rounded-[1.75rem] border border-slate-200/90 bg-white shadow-[0_24px_50px_-36px_rgba(15,23,42,0.45)]">
          <header className="border-b border-slate-200/80 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-500">
                  <h3 className="truncate text-lg font-semibold text-slate-950">
                    {selectedConversation?.contactName || "No conversation selected"}
                  </h3>
                  {selectedConversation ? (
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                      title={selectedConversation.channel}
                      aria-label={selectedConversation.channel}
                    >
                      <img
                        src={getChannelIconSrc(selectedConversation.channel)}
                        alt=""
                        aria-hidden="true"
                        className="h-3.5 w-3.5 object-contain"
                      />
                    </span>
                  ) : null}
                </div>

                {selectedConversation ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
                        getActivityTone(selectedConversation.aiState),
                      ].join(" ")}
                    >
                      {getActivityIcon(selectedConversation.aiState)}
                      {activityLabel}
                    </span>
                    {viewedByLabel ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                          <circle cx="12" cy="12" r="2.5" />
                        </svg>
                        Viewed By: {viewedByLabel}
                      </span>
                    ) : null}
                    {replyingByLabel ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v7A2.5 2.5 0 0 1 17.5 17H10l-4.5 3V17H6.5A2.5 2.5 0 0 1 4 14.5v-7Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 10h6M9 13h4" />
                        </svg>
                        Replying: {replyingByLabel}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
                  {([
                    { value: "open", label: "Open" },
                    { value: "pending", label: "Pending" },
                    { value: "resolved", label: "Resolved" },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => void handleStatusUpdate(option.value)}
                      disabled={!selectedConversation || isUpdatingStatus}
                      className={[
                        "h-8 rounded-full px-3 text-xs font-semibold transition",
                        selectedConversation?.status === option.value
                          ? "bg-slate-900 text-white"
                          : "text-slate-500 hover:bg-white hover:text-slate-900",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                      ].join(" ")}
                      aria-label={`Set status ${option.label}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleInspectorButtonClick}
                  disabled={!selectedConversation || isUpdatingStatus || isDeletingChatUser}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={isInspectorCollapsed ? "Show inspector" : "Hide inspector"}
                  title={isInspectorCollapsed ? "Show inspector" : "Hide inspector"}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <rect x="3.75" y="4.75" width="16.5" height="14.5" rx="2.25" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 5v14" />
                    {isInspectorCollapsed ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="m11 12-2.5-2.5m2.5 2.5L8.5 14.5" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="m10 12 2.5-2.5M10 12l2.5 2.5" />
                    )}
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => void handleDeleteChatUser()}
                  disabled={
                    !selectedConversation ||
                    !selectedConversation.contactId ||
                    isUpdatingStatus ||
                    isDeletingChatUser
                  }
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-500 transition hover:bg-white hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Delete chat user and messages"
                  title="Delete chat user"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    className="h-4 w-4"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-9 0 1 14a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-14"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-hidden bg-slate-50/70 px-4 py-4">
            {!selectedConversation ? (
              <div className="flex h-full items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300 bg-white px-6 text-center shadow-sm">
                <p className="text-sm text-slate-400">Select a conversation</p>
              </div>
            ) : isLoadingThread ? (
              <div className="flex h-full items-center justify-center rounded-[1.5rem] bg-white shadow-sm">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
              </div>
            ) : (
              <div className="h-full px-1 py-1">
                <ThreadView
                  messages={messages}
                  replyingByLabel={replyingByLabel || null}
                />
              </div>
            )}
          </div>

          {selectedConversation ? (
            <div className="border-t border-slate-200/80 bg-white px-4 py-3">
              <Composer
                disabled={isSending || !selectedConversationId || !!composerDisabledReason}
                disabledReason={composerDisabledReason}
                error={sendError}
                channel={selectedConversation?.channel ?? null}
                cannedReplies={cannedReplies}
                stickerCatalog={stickerCatalog}
                stickerCatalogError={stickerCatalogError}
                isStickerCatalogLoading={isLoadingStickerCatalog}
                onSend={handleSend}
                onSendSticker={handleSendSticker}
                onComposeActivityChange={handleComposeActivityChange}
              />
            </div>
          ) : null}
        </section>

        {!isInspectorCollapsed ? (
          <aside className="hidden w-[22rem] shrink-0 flex-col rounded-[1.75rem] border border-slate-200/90 bg-slate-50/80 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.45)] xl:flex">
            <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Inspector
                </p>
                <h4 className="mt-1 text-sm font-semibold text-slate-900">
                  Conversation Details
                </h4>
              </div>

              <button
                type="button"
                onClick={handleCollapseInspector}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Collapse inspector"
                title="Collapse inspector"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.5 7-5 5 5 5" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ContactPanel
                contact={contact}
                conversation={selectedConversation}
                currentUserId={session?.user?._id ?? null}
                presence={conversationPresence[selectedConversation?._id ?? ""] ?? []}
                onConversationUpdated={handleConversationUpdated}
                onContactUpdated={handleContactUpdated}
              />
            </div>
          </aside>
        ) : null}
      </div>

      {isContactPanelOpen ? (
        <>
          <button
            type="button"
            aria-label="Close details"
            className="fixed inset-0 z-30 bg-slate-900/20 xl:hidden"
            onClick={() => setIsContactPanelOpen(false)}
          />

          <aside className="fixed inset-y-0 right-0 z-40 flex w-[22rem] max-w-[92vw] flex-col border-l border-slate-200 bg-slate-50 shadow-xl xl:hidden">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
              <h4 className="text-sm font-semibold text-slate-900">Conversation Details</h4>
              <button
                type="button"
                onClick={() => setIsContactPanelOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close details"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-4 w-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ContactPanel
                contact={contact}
                conversation={selectedConversation}
                currentUserId={session?.user?._id ?? null}
                presence={conversationPresence[selectedConversation?._id ?? ""] ?? []}
                onConversationUpdated={handleConversationUpdated}
                onContactUpdated={handleContactUpdated}
              />
            </div>
          </aside>
        </>
      ) : null}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
