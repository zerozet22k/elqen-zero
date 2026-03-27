import { Channel } from "../../types/models";

export type StickerPreview = {
  kind: "image" | "video" | "tgs" | "fallback";
  url?: string;
  mimeType?: string;
};

export type StickerCatalogItem = {
  id: string;
  platformStickerId: string;
  label: string;
  description?: string;
  emoji?: string;
  preview?: StickerPreview;
  providerMeta?: {
    telegram?: {
      fileId: string;
      thumbnailFileId?: string;
      isAnimated?: boolean;
      isVideo?: boolean;
    };
    viber?: {
      previewUrl?: string;
    };
    line?: {
      packageId: string;
      stickerResourceType?: string;
      storeUrl?: string;
      packTitle?: string;
    };
  };
};

export type StickerCatalog = {
  channel: Channel;
  supported: boolean;
  items: StickerCatalogItem[];
};
