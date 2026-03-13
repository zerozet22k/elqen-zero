import { Router } from "express";
import { NotFoundError } from "../../lib/errors";
import { asyncHandler } from "../../lib/async-handler";
import { objectIdParamSchema } from "../../lib/validators";
import { contactService } from "../../services/contact.service";

const router = Router();

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = objectIdParamSchema.parse(req.params);
    const contact = await contactService.getById(id);
    if (!contact) {
      throw new NotFoundError("Contact not found");
    }

    res.json({ contact });
  })
);

export default router;
