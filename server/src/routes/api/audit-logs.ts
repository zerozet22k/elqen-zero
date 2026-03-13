import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { auditLogQuerySchema } from "../../lib/validators";
import { auditLogService } from "../../services/audit-log.service";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = auditLogQuerySchema.parse(req.query);
    const items = await auditLogService.list(query);
    res.json({ items });
  })
);

export default router;
