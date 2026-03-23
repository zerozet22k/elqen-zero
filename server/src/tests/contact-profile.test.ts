import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let app: import("express").Express;
let models: typeof import("../models");
const testDbName = `chatbot_contact_profile_test_${Date.now()}`;

const createAuthHeaders = async (params: {
  workspaceId: string;
  role: "owner" | "admin" | "staff";
  email: string;
}) => {
  const user = await models.UserModel.create({
    email: params.email,
    name: params.email.split("@")[0],
    passwordHash: "hashed",
    role: params.role,
    workspaceIds: [params.workspaceId],
  });

  await models.WorkspaceMembershipModel.create({
    workspaceId: params.workspaceId,
    userId: user._id,
    role: params.role,
    status: "active",
  });

  const token = jwt.sign(
    {
      userId: String(user._id),
      email: user.email,
    },
    process.env.JWT_SECRET || "test-secret"
  );

  return {
    Authorization: `Bearer ${token}`,
    "x-workspace-id": params.workspaceId,
  };
};

beforeAll(async () => {
  process.env.CLIENT_URL = "http://localhost:3000";
  process.env.MONGO_URL = "mongodb://localhost:27017";
  process.env.MONGO_DB = testDbName;
  process.env.JWT_SECRET = "test-secret";
  process.env.SESSION_SECRET = "test-secret";

  models = await import("../models");
  await mongoose.connect(`${process.env.MONGO_URL}/${process.env.MONGO_DB}`);
  app = (await import("../app")).createApp();
}, 60000);

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}, 60000);

describe("contact profile API", () => {
  it("updates saved customer profile fields", async () => {
    const workspace = await models.WorkspaceModel.create({
      name: "Workspace",
      slug: "contact-profile-update",
      timeZone: "UTC",
    });

    const headers = await createAuthHeaders({
      workspaceId: String(workspace._id),
      role: "admin",
      email: "admin@test.local",
    });

    const contact = await models.ContactModel.create({
      workspaceId: workspace._id,
      primaryName: "Thi Ha Zaw",
      phones: [],
      deliveryAddress: "",
      notes: "",
      aiNotes: "",
      channelIdentities: [
        {
          channel: "viber",
          externalUserId: "customer-1",
        },
      ],
    });

    const response = await request(app)
      .patch(`/api/contacts/${contact._id}`)
      .set(headers)
      .send({
        phones: ["09 123 456 789", "09 123 456 789"],
        deliveryAddress: "Yangon, Bahan Township",
        notes: "Prefers afternoon follow-up.",
        aiNotes: "Customer usually confirms through Viber.",
      });

    expect(response.status).toBe(200);
    expect(response.body.contact.phones).toEqual(["09 123 456 789"]);
    expect(response.body.contact.deliveryAddress).toBe("Yangon, Bahan Township");
    expect(response.body.contact.notes).toBe("Prefers afternoon follow-up.");
    expect(response.body.contact.aiNotes).toBe(
      "Customer usually confirms through Viber."
    );
  });
});
