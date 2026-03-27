import { Message } from "../../types/models";
import { API_BASE_URL } from "../../services/api-base";

export type RenderableMediaItem = {
  preferredUrl: string | null;
  isExpired: boolean;
  hasDurableCopy: boolean;
  filename?: string;
  size?: number;
};

export type RenderableMedia = {
  preferredUrl: string | null;
  isExpired: boolean;
  hasDurableCopy: boolean;
  items: RenderableMediaItem[];
};

type LineStickerPreviewDecision = {
  shouldRenderImage: boolean;
  fallbackReason?: string;
};

const resolveMediaUrl = (url?: string | null) => {
  if (!url) {
    return null;
  }

  try {
    return new URL(url, API_BASE_URL).toString();
  } catch {
    return url;
  }
};

export function resolveLineStickerPreviewDecision(message: Message): LineStickerPreviewDecision {
  if (message.channel !== "line" || message.kind !== "sticker") {
    return { shouldRenderImage: true };
  }

  // Always try to render if a URL exists. The stickershop CDN proxy route returns
  // verified image/* content or 404; the <img onError> handler hides failed loads.
  const firstMedia = message.media?.[0];
  const previewUrl = resolveMediaUrl(firstMedia?.storedAssetUrl ?? firstMedia?.url ?? null);
  if (!previewUrl) {
    return { shouldRenderImage: false, fallbackReason: "preview_url_missing" };
  }

  return { shouldRenderImage: true };
}

export function resolveRenderableMedia(message: Message): RenderableMedia {
  const items: RenderableMediaItem[] = (message.media ?? []).map((media) => {
    const hasDurableCopy = Boolean(media.storedAssetUrl);
    const expiresAtMillis = media.expiresAt ? new Date(media.expiresAt).getTime() : null;
    const isExpired =
      Boolean(media.isTemporary) &&
      Boolean(expiresAtMillis) &&
      Number.isFinite(expiresAtMillis) &&
      (expiresAtMillis as number) <= Date.now();

    if (hasDurableCopy) {
      return {
        preferredUrl: resolveMediaUrl(media.storedAssetUrl),
        isExpired,
        hasDurableCopy,
        filename: media.filename,
        size: media.size,
      };
    }

    if (isExpired) {
      return {
        preferredUrl: null,
        isExpired,
        hasDurableCopy,
        filename: media.filename,
        size: media.size,
      };
    }

    return {
      preferredUrl: resolveMediaUrl(media.url),
      isExpired,
      hasDurableCopy,
      filename: media.filename,
      size: media.size,
    };
  });

  const first = items[0];
  const lineStickerPreview = resolveLineStickerPreviewDecision(message);

  if (!lineStickerPreview.shouldRenderImage) {
    return {
      preferredUrl: null,
      isExpired: Boolean(first?.isExpired),
      hasDurableCopy: Boolean(first?.hasDurableCopy),
      items: items.map((item, index) =>
        index === 0
          ? {
              ...item,
              preferredUrl: null,
            }
          : item
      ),
    };
  }

  return {
    preferredUrl: first?.preferredUrl ?? null,
    isExpired: Boolean(first?.isExpired),
    hasDurableCopy: Boolean(first?.hasDurableCopy),
    items,
  };
}
