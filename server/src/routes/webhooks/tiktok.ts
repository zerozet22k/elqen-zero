import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { IntegrationNotReadyError } from "../../lib/errors";

const router = Router();

router.post(
  "/",
  asyncHandler(async (_req, _res) => {
    throw new IntegrationNotReadyError(
      "TikTok webhook support is scaffold-only until public business messaging support is verified."
    );
  })
);

export default router;
