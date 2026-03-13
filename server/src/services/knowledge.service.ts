import { KnowledgeItemModel } from "../models";

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);

class KnowledgeService {
  async list(workspaceId: string) {
    return KnowledgeItemModel.find({ workspaceId }).sort({ updatedAt: -1 });
  }

  async create(payload: {
    workspaceId: string;
    title: string;
    content: string;
    tags: string[];
  }) {
    return KnowledgeItemModel.create(payload);
  }

  async getById(id: string) {
    return KnowledgeItemModel.findById(id);
  }

  async update(
    id: string,
    patch: {
      title?: string;
      content?: string;
      tags?: string[];
      isActive?: boolean;
    }
  ) {
    return KnowledgeItemModel.findByIdAndUpdate(id, { $set: patch }, { new: true });
  }

  async remove(id: string) {
    return KnowledgeItemModel.findByIdAndDelete(id);
  }

  async findBestMatch(workspaceId: string, queryText: string) {
    const items = await KnowledgeItemModel.find({
      workspaceId,
      isActive: true,
    });

    const queryTokens = tokenize(queryText);
    if (!queryTokens.length) {
      return null;
    }

    let best:
      | {
          item: (typeof items)[number];
          confidence: number;
        }
      | null = null;

    for (const item of items) {
      const haystack = tokenize(`${item.title} ${item.content} ${item.tags.join(" ")}`);
      const titleAndTags = tokenize(`${item.title} ${item.tags.join(" ")}`);
      const overlap = queryTokens.filter((token) => haystack.includes(token)).length;
      const priorityOverlap = queryTokens.filter((token) =>
        titleAndTags.includes(token)
      ).length;
      const exactTitleMatch =
        item.title.toLowerCase().includes(queryText.toLowerCase()) ||
        queryText.toLowerCase().includes(item.title.toLowerCase());
      const confidence = exactTitleMatch
        ? 0.9
        : Math.max(
            overlap / queryTokens.length + 0.15,
            priorityOverlap / queryTokens.length + 0.2
          );
      if (!best || confidence > best.confidence) {
        best = { item, confidence };
      }
    }

    if (!best || best.confidence < 0.45) {
      return null;
    }

    return {
      kind: "knowledge" as const,
      confidence: Math.min(0.85, best.confidence + 0.15),
      sourceHints: [best.item.title],
      text: best.item.content,
    };
  }
}

export const knowledgeService = new KnowledgeService();
