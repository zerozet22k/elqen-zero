import { InferSchemaType, HydratedDocument, Schema, model } from "mongoose";
import {
  CHANNELS,
  CONVERSATION_AI_STATES,
  CONVERSATION_STATUSES,
} from "../channels/types";

const conversationSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    channel: {
      type: String,
      enum: CHANNELS,
      required: true,
    },
    channelAccountId: { type: String, required: true },
    externalChatId: { type: String, required: true },
    externalUserId: { type: String },
    contactId: { type: Schema.Types.ObjectId, ref: "Contact" },
    assigneeUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: {
      type: String,
      enum: CONVERSATION_STATUSES,
      default: "open",
    },
    unreadCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date, default: null },
    lastMessageText: { type: String, default: "" },
    aiEnabled: { type: Boolean, default: true },
    aiState: {
      type: String,
      enum: CONVERSATION_AI_STATES,
      default: "idle",
    },
    tags: { type: [String], default: [] },
  },
  {
    collection: "conversations",
    timestamps: true,
  }
);

conversationSchema.index(
  { workspaceId: 1, channel: 1, channelAccountId: 1, externalChatId: 1 },
  { unique: true }
);

conversationSchema.index({ workspaceId: 1, lastMessageAt: -1 });

export type ConversationDocument = HydratedDocument<
  InferSchemaType<typeof conversationSchema>
>;

export const ConversationModel = model("Conversation", conversationSchema);
