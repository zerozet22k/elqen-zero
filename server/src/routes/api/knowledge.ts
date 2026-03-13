import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { NotFoundError } from "../../lib/errors";
import {
  createKnowledgeItemSchema,
  objectIdParamSchema,
  updateKnowledgeItemSchema,
} from "../../lib/validators";
import { knowledgeService } from "../../services/knowledge.service";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.query.workspaceId ?? "");
    const items = await knowledgeService.list(workspaceId);
    res.json({ items });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = createKnowledgeItemSchema.parse(req.body);
    const item = await knowledgeService.create(payload);
    res.status(201).json({ item });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = objectIdParamSchema.parse(req.params);
    const item = await knowledgeService.getById(id);
    if (!item) {
      throw new NotFoundError("Knowledge item not found");
    }

    res.json({ item });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = objectIdParamSchema.parse(req.params);
    const patch = updateKnowledgeItemSchema.parse(req.body);
    const item = await knowledgeService.update(id, patch);
    if (!item) {
      throw new NotFoundError("Knowledge item not found");
    }

    res.json({ item });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = objectIdParamSchema.parse(req.params);
    const item = await knowledgeService.remove(id);
    if (!item) {
      throw new NotFoundError("Knowledge item not found");
    }

    res.json({ deleted: true });
  })
);

export default router;
