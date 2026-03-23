import { describe, expect, it } from "vitest";
import {
  getComposerDisabledReason,
  isConnectionUsableForSending,
  shouldPersistSendError,
} from "./inbox-state";

describe("inbox send state", () => {
  it("allows sending on verified connections even if the runtime status is error", () => {
    expect(
      isConnectionUsableForSending({
        _id: "1",
        workspaceId: "ws",
        channel: "viber",
        displayName: "Viber",
        externalAccountId: "acc",
        status: "error",
        webhookVerified: true,
        verificationState: "verified",
        lastError: "Temporary provider failure",
        credentials: {},
        webhookConfig: {},
        capabilities: {},
      })
    ).toBe(true);
  });

  it("keeps composer enabled for verified runtime-error connections", () => {
    const reason = getComposerDisabledReason({
      selectedConversation: {
        _id: "c1",
        workspaceId: "ws",
        channel: "viber",
        channelAccountId: "acc",
        externalChatId: "chat",
        status: "open",
        unreadCount: 0,
        aiEnabled: true,
        aiState: "idle",
        tags: [],
      },
      selectedConnection: {
        _id: "1",
        workspaceId: "ws",
        channel: "viber",
        displayName: "Viber",
        externalAccountId: "acc",
        status: "error",
        webhookVerified: true,
        verificationState: "verified",
        lastError: "Temporary provider failure",
        credentials: {},
        webhookConfig: {},
        capabilities: {},
      },
      supportedChannels: {
        facebook: true,
        telegram: true,
        viber: true,
        tiktok: true,
      },
    });

    expect(reason).toBeUndefined();
  });

  it("does not persist transient send errors when the connection is still usable", () => {
    expect(
      shouldPersistSendError({
        message: "receiver is not subscribed",
        selectedConnection: {
          _id: "1",
          workspaceId: "ws",
          channel: "viber",
          displayName: "Viber",
          externalAccountId: "acc",
          status: "active",
          webhookVerified: true,
          verificationState: "verified",
          lastError: "receiver is not subscribed",
          credentials: {},
          webhookConfig: {},
          capabilities: {},
        },
      })
    ).toBe(false);
  });
});
