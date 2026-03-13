import { CannedReplyModel } from "../models";

class CannedReplyService {
  private normalizeTriggers(triggers: string[]) {
    return [...new Set(
      triggers
        .map((trigger) => trigger.trim())
        .filter((trigger) => trigger.length > 0)
    )];
  }

  async list(workspaceId: string) {
    return CannedReplyModel.find({ workspaceId }).sort({ updatedAt: -1 });
  }

  async create(payload: {
    workspaceId: string;
    title: string;
    body: string;
    triggers: string[];
    category: string;
  }) {
    return CannedReplyModel.create({
      ...payload,
      triggers: this.normalizeTriggers(payload.triggers),
    });
  }

  async getById(id: string) {
    return CannedReplyModel.findById(id);
  }

  async update(
    id: string,
    patch: {
      title?: string;
      body?: string;
      triggers?: string[];
      category?: string;
      isActive?: boolean;
    }
  ) {
    return CannedReplyModel.findByIdAndUpdate(
      id,
      {
        $set: {
          ...patch,
          ...(patch.triggers
            ? { triggers: this.normalizeTriggers(patch.triggers) }
            : {}),
        },
      },
      { new: true }
    );
  }

  async remove(id: string) {
    return CannedReplyModel.findByIdAndDelete(id);
  }
}

export const cannedReplyService = new CannedReplyService();