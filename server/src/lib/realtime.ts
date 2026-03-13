import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "../config/env";

type RealtimeEventName =
  | "conversation.created"
  | "conversation.updated"
  | "message.received"
  | "message.sent"
  | "message.failed"
  | "connection.updated";

type RealtimePayload = {
  workspaceId: string;
  [key: string]: unknown;
};

let io: SocketIOServer | null = null;

const getWorkspaceRoom = (workspaceId: string) => `workspace:${workspaceId}`;

export const initializeRealtime = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: env.SOCKET_ORIGIN || env.CLIENT_URL,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    const workspaceId = socket.handshake.query.workspaceId;
    if (typeof workspaceId === "string" && workspaceId.trim()) {
      socket.join(getWorkspaceRoom(workspaceId));
    }

    socket.on("workspace.subscribe", (nextWorkspaceId: string) => {
      if (typeof nextWorkspaceId === "string" && nextWorkspaceId.trim()) {
        socket.join(getWorkspaceRoom(nextWorkspaceId));
      }
    });

    socket.on("workspace.unsubscribe", (nextWorkspaceId: string) => {
      if (typeof nextWorkspaceId === "string" && nextWorkspaceId.trim()) {
        socket.leave(getWorkspaceRoom(nextWorkspaceId));
      }
    });
  });

  return io;
};

export const emitRealtimeEvent = (
  event: RealtimeEventName,
  payload: RealtimePayload
) => {
  if (!io) {
    return;
  }

  io.to(getWorkspaceRoom(payload.workspaceId)).emit(event, payload);
};
