import { InferSchemaType, HydratedDocument, Schema, model } from "mongoose";

const aiSettingsSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      unique: true,
    },
    enabled: { type: Boolean, default: false },
    autoReplyEnabled: { type: Boolean, default: false },
    afterHoursEnabled: { type: Boolean, default: false },
    confidenceThreshold: { type: Number, default: 0.7 },
    fallbackMessage: {
      type: String,
      default: "Thanks for your message. A teammate will follow up soon.",
    },
  },
  {
    collection: "ai_settings",
    timestamps: true,
  }
);

export type AISettingsDocument = HydratedDocument<
  InferSchemaType<typeof aiSettingsSchema>
>;

export const AISettingsModel = model("AISettings", aiSettingsSchema);
