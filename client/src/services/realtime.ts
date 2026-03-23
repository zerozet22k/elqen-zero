import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "./api-base";

export type WorkspaceSocketEvent =
  | "conversation.created"
  | "conversation.updated"
  | "contact.updated"
  | "message.received"
  | "message.sent"
  | "message.failed"
  | "connection.updated"
  | "presence.updated";

export const connectWorkspaceSocket = (
  workspaceId: string,
  user?: {
    userId?: string | null;
    userName?: string | null;
  }
): Socket => {
  return io(API_BASE_URL, {
    transports: ["websocket", "polling"],
    query: {
      workspaceId,
      userId: user?.userId ?? undefined,
      userName: user?.userName ?? undefined,
    },
  });
};
