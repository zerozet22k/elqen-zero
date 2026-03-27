import { Channel } from "../types/models";

export class PlatformIcons {
  private static readonly iconByChannel: Record<Channel, string> = {
    facebook: "/platform-icons/facebook.svg",
    instagram: "/platform-icons/instagram.svg",
    telegram: "/platform-icons/telegram.svg",
    viber: "/platform-icons/viber.svg",
    tiktok: "/platform-icons/tiktok.svg",
    line: "/platform-icons/line.svg",
    website: "/platform-icons/website.svg",
  };

  static getIconUrl(channel: Channel): string {
    return this.iconByChannel[channel] ?? this.iconByChannel.website;
  }
}
