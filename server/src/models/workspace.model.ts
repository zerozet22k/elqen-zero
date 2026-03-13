import { InferSchemaType, HydratedDocument, Schema, model } from "mongoose";

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    timeZone: { type: String, default: "Asia/Bangkok" },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    collection: "workspaces",
    timestamps: true,
  }
);

export type WorkspaceDocument = HydratedDocument<
  InferSchemaType<typeof workspaceSchema>
>;

export const WorkspaceModel = model("Workspace", workspaceSchema);
