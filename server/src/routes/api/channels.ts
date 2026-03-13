import { Router } from "express";
import { z } from "zod";
import { CHANNELS } from "../../channels/types";
import { asyncHandler } from "../../lib/async-handler";
import { createChannelConnectionSchema } from "../../lib/validators";
import { channelConnectionService } from "../../services/channel-connection.service";

const router = Router();
const workspaceQuerySchema = z.object({
  workspaceId: z.string().min(1),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { workspaceId } = workspaceQuerySchema.parse(req.query);
    const items = await channelConnectionService.listConnectionsByWorkspace(
      workspaceId
    );
    res.json({ items: channelConnectionService.serializeMany(items) });
  })
);

router.post(
  "/:channel/connect",
  asyncHandler(async (req, res) => {
    const channel = z.enum(CHANNELS).parse(req.params.channel);
    const payload = createChannelConnectionSchema.parse(req.body);
    const connection = await channelConnectionService.createConnection(channel, payload);
    res.status(201).json({
      connection: channelConnectionService.serialize(connection),
    });
  })
);

router.post(
  "/:channel/test",
  asyncHandler(async (req, res) => {
    const channel = z.enum(CHANNELS).parse(req.params.channel);
    const payload = createChannelConnectionSchema.parse(req.body);
    const diagnostics = await channelConnectionService.validateConnection(
      channel,
      payload
    );
    res.json({ diagnostics });
  })
);

export default router;
