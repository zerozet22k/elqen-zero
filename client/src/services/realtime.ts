import { io, Socket } from "socket.io-client";

const API_URL =
  import.meta.env.VITE_API_URL ??
  import.meta.env.REACT_APP_API_URL ??
  "http://localhost:4000";

export type WorkspaceSocketEvent =
  | "conversation.created"
  | "conversation.updated"
  | "message.received"
  | "message.sent"
  | "message.failed"
  | "connection.updated";

export const connectWorkspaceSocket = (workspaceId: string): Socket => {
  return io(API_URL, {
    transports: ["websocket", "polling"],
    query: {
      workspaceId,
    },
  });
};
