import { BaseChannelAdapter } from "./base.adapter";
import { IntegrationNotReadyError } from "../lib/errors";
import { ChannelCapabilities } from "./types";

export class TikTokAdapter extends BaseChannelAdapter {
  channel = "tiktok" as const;

  getCapabilities(): ChannelCapabilities {
    return {
      inbound: {
        text: false,
        image: false,
        video: false,
        audio: false,
        file: false,
        location: false,
        contact: false,
        interactive: false,
      },
      outbound: {
        text: false,
        image: false,
        video: false,
        audio: false,
        file: false,
        location: false,
        contact: false,
        interactive: false,
      },
    };
  }

  async parseInbound(): Promise<never> {
    throw new IntegrationNotReadyError(
      "TikTok messaging integration is scaffold-only until public business messaging support is verified."
    );
  }

  async sendOutbound(): Promise<never> {
    throw new IntegrationNotReadyError(
      "TikTok outbound messaging is not implemented because public business messaging support has not been verified."
    );
  }
}
