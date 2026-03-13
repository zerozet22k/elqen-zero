import { Router } from "express";
import { NotFoundError } from "../../lib/errors";
import { asyncHandler } from "../../lib/async-handler";
import {
  conversationQuerySchema,
  createOutboundMessageSchema,
  objectIdParamSchema,
  updateConversationSchema,
} from "../../lib/validators";
import { conversationService } from "../../services/conversation.service";
import { contactService } from "../../services/contact.service";
import { messageService } from "../../services/message.service";
import { outboundMessageService } from "../../services/outbound-message.service";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = conversationQuerySchema.parse(req.query);
    const items = await conversationService.list(query);
    res.json({ items });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = objectIdParamSchema.parse(req.params);
    const conversation = await conversationService.getById(id);
    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    const contact = conversation.contactId
      ? await contactService.getById(String(conversation.contactId))
      : null;

    res.json({
      conversation,
      contact,
    });
  })
);

router.get(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const { id } = objectIdParamSchema.parse(req.params);
    const items = await messageService.listByConversation(id);
    res.json({ items });
  })
);

router.post(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const { id } = objectIdParamSchema.parse(req.params);
    const command = createOutboundMessageSchema.parse(req.body);
    const result = await outboundMessageService.send({
      conversationId: id,
      command,
      source: "inbox",
    });
    res.status(201).json(result);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = objectIdParamSchema.parse(req.params);
    const patch = updateConversationSchema.parse(req.body);
    const conversation = await conversationService.updateById(id, patch);
    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    res.json({ conversation });
  })
);

export default router;
