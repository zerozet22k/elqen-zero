import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { useSession } from "../hooks/use-session";
import { apiRequest } from "../services/api";
import { API_BASE_URL } from "../services/api-base";
import { WorkspaceStickerLibraryItem } from "../types/models";
import { PlatformIcons } from "../utils/platform-icons";

type StickerChannel = WorkspaceStickerLibraryItem["channel"];
type ChannelFilter = StickerChannel | "all";
type StickerLibraryView = "library" | "manual";

type StickerLibraryResponse = {
  items: WorkspaceStickerLibraryItem[];
};

type CreateStickerResponse = {
  item: WorkspaceStickerLibraryItem;
};

const channelOptions: StickerChannel[] = ["telegram", "viber", "line"];

const channelLabels: Record<StickerChannel, string> = {
  telegram: "Telegram",
  viber: "Viber",
  line: "LINE",
};

const trimString = (value: string) => value.trim();

const resolvePreviewUrl = (item: WorkspaceStickerLibraryItem) => {
  if (item.channel === "line") {
    const stickerId = trimString(item.platformStickerId);
    const packageId = trimString(item.providerMeta?.line?.packageId ?? "");
    if (!stickerId || !packageId) {
      return null;
    }

    return new URL(
      `/api/stickers/proxy/${encodeURIComponent(stickerId)}/${encodeURIComponent(packageId)}`,
      API_BASE_URL
    ).toString();
  }

  if (item.channel === "viber") {
    const previewUrl = trimString(item.providerMeta?.viber?.previewUrl ?? "");
    return previewUrl || null;
  }

  return null;
};

function StickerPreviewCard({ item }: { item: WorkspaceStickerLibraryItem }) {
  const [hidden, setHidden] = useState(false);
  const previewUrl = resolvePreviewUrl(item);

  if (!hidden && previewUrl) {
    return (
      <img
        src={previewUrl}
        alt={item.label}
        className="h-18 w-18 object-contain"
        loading="lazy"
        onError={() => setHidden(true)}
      />
    );
  }

  return (
    <div className="flex h-18 w-18 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
      {item.emoji?.trim() || ":)"}
    </div>
  );
}

export function StickerLibraryPage() {
  const { activeWorkspace } = useSession();
  const workspaceId = activeWorkspace?._id;

  const [activeView, setActiveView] = useState<StickerLibraryView>("library");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [channel, setChannel] = useState<StickerChannel>("telegram");
  const [platformStickerId, setPlatformStickerId] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("");
  const [telegramThumbnailFileId, setTelegramThumbnailFileId] = useState("");
  const [telegramIsAnimated, setTelegramIsAnimated] = useState(false);
  const [telegramIsVideo, setTelegramIsVideo] = useState(false);
  const [viberPreviewUrl, setViberPreviewUrl] = useState("");
  const [linePackageId, setLinePackageId] = useState("");
  const [lineStickerResourceType, setLineStickerResourceType] = useState("");
  const [linePackTitle, setLinePackTitle] = useState("");

  const [items, setItems] = useState<WorkspaceStickerLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    try {
      setLoading(true);
      setPageError(null);

      const response = await apiRequest<StickerLibraryResponse>(
        "/api/stickers",
        {},
        channelFilter === "all" ? undefined : { channel: channelFilter }
      );

      setItems(response.items);
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Failed to load sticker library."
      );
    } finally {
      setLoading(false);
    }
  }, [channelFilter, workspaceId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const resetForm = () => {
    setPlatformStickerId("");
    setLabel("");
    setDescription("");
    setEmoji("");
    setTelegramThumbnailFileId("");
    setTelegramIsAnimated(false);
    setTelegramIsVideo(false);
    setViberPreviewUrl("");
    setLinePackageId("");
    setLineStickerResourceType("");
    setLinePackTitle("");
  };

  const groupedItems = useMemo(() => {
    const groups: Record<StickerChannel, WorkspaceStickerLibraryItem[]> = {
      telegram: [],
      viber: [],
      line: [],
    };

    for (const item of items) {
      groups[item.channel].push(item);
    }

    return groups;
  }, [items]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspaceId) {
      return;
    }

    try {
      setSaving(true);
      setFormError(null);
      setSuccessMessage(null);

      const normalizedStickerId = trimString(platformStickerId);
      const normalizedLabel =
        trimString(label) || `${channelLabels[channel]} sticker ${normalizedStickerId}`;

      await apiRequest<CreateStickerResponse>("/api/stickers", {
        method: "POST",
        body: JSON.stringify({
          channel,
          platformStickerId: normalizedStickerId,
          label: normalizedLabel,
          description: trimString(description) || undefined,
          emoji: trimString(emoji) || undefined,
          providerMeta:
            channel === "telegram"
              ? {
                  telegram: {
                    fileId: normalizedStickerId,
                    thumbnailFileId: trimString(telegramThumbnailFileId) || undefined,
                    isAnimated: telegramIsAnimated || undefined,
                    isVideo: telegramIsVideo || undefined,
                  },
                }
              : channel === "viber"
                ? {
                    viber: {
                      previewUrl: trimString(viberPreviewUrl) || undefined,
                    },
                  }
                : {
                    line: {
                      packageId: trimString(linePackageId),
                      stickerResourceType:
                        trimString(lineStickerResourceType) || undefined,
                      packTitle: trimString(linePackTitle) || undefined,
                    },
                  },
        }),
      });

      setSuccessMessage("Sticker saved to this workspace library.");
      resetForm();
      setActiveView("library");
      await loadItems();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to save sticker."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      setPageError(null);
      setSuccessMessage(null);

      await apiRequest(`/api/stickers/${id}`, {
        method: "DELETE",
      });

      setSuccessMessage("Sticker removed from this workspace library.");
      await loadItems();
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Failed to delete sticker."
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (!workspaceId) {
    return (
      <div className="min-h-dvh bg-slate-100/80 p-6">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
          No workspace session found.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh space-y-6 bg-slate-100/80 p-6">
      <section className="rounded-[1.75rem] border border-slate-200/90 bg-white p-6 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.45)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Workspace
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Workspace Stickers
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Save the provider stickers your team actually uses inside this workspace.
              This is a workspace catalog, not a full browser for native Telegram,
              Viber, or LINE sticker packs.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <span className="font-medium text-slate-900">{activeWorkspace?.name}</span>
            <span className="text-slate-400">workspace</span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
            {[
              { key: "library", label: "Saved stickers" },
              { key: "manual", label: "Add manually" },
            ].map((option) => {
              const active = activeView === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setActiveView(option.key as StickerLibraryView)}
                  className={[
                    "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition",
                    active
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-600 hover:text-slate-950",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {activeView === "library" ? (
            <div className="flex flex-wrap gap-2">
              {(["all", ...channelOptions] as const).map((option) => {
                const active = channelFilter === option;
                const optionLabel =
                  option === "all" ? "All channels" : channelLabels[option];

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setChannelFilter(option)}
                    className={[
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
                      active
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900",
                    ].join(" ")}
                  >
                    {option === "all" ? null : (
                      <img
                        src={PlatformIcons.getIconUrl(option)}
                        alt=""
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    )}
                    {optionLabel}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {pageError ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {pageError}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}
      </section>

      {activeView === "manual" ? (
        <section className="rounded-[1.75rem] border border-slate-200/90 bg-white p-6 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.45)]">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <AddRoundedIcon className="h-5 w-5" aria-hidden="true" />
            </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Add sticker manually</h2>
                <p className="text-sm text-slate-500">
                  Save a provider sticker reference when this workspace does not
                  already have it in the saved list.
                </p>
              </div>
            </div>

          <form className="mt-5 grid gap-4 xl:grid-cols-2" onSubmit={handleCreate}>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Channel</span>
              <select
                value={channel}
                onChange={(event) => setChannel(event.target.value as StickerChannel)}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                {channelOptions.map((option) => (
                  <option key={option} value={option}>
                    {channelLabels[option]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Sticker ID</span>
              <input
                value={platformStickerId}
                onChange={(event) => setPlatformStickerId(event.target.value)}
                placeholder={
                  channel === "telegram"
                    ? "Telegram file_id"
                    : channel === "viber"
                      ? "Viber sticker_id"
                      : "LINE stickerId"
                }
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Label</span>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Friendly sticker name"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Emoji</span>
              <input
                value={emoji}
                onChange={(event) => setEmoji(event.target.value)}
                placeholder="Optional emoji fallback"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="block space-y-1.5 xl:col-span-2">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional note for your team"
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            {channel === "telegram" ? (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Thumbnail file ID
                  </span>
                  <input
                    value={telegramThumbnailFileId}
                    onChange={(event) => setTelegramThumbnailFileId(event.target.value)}
                    placeholder="Optional thumbnail file_id"
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2 xl:col-span-2">
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={telegramIsAnimated}
                      onChange={(event) => setTelegramIsAnimated(event.target.checked)}
                    />
                    Animated sticker
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={telegramIsVideo}
                      onChange={(event) => setTelegramIsVideo(event.target.checked)}
                    />
                    Video sticker
                  </label>
                </div>
              </>
            ) : null}

            {channel === "viber" ? (
              <label className="block space-y-1.5 xl:col-span-2">
                <span className="text-sm font-medium text-slate-700">Preview URL</span>
                <input
                  value={viberPreviewUrl}
                  onChange={(event) => setViberPreviewUrl(event.target.value)}
                  placeholder="https://..."
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </label>
            ) : null}

            {channel === "line" ? (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Package ID</span>
                  <input
                    value={linePackageId}
                    onChange={(event) => setLinePackageId(event.target.value)}
                    placeholder="LINE packageId"
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    required
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Sticker resource type
                  </span>
                  <input
                    value={lineStickerResourceType}
                    onChange={(event) =>
                      setLineStickerResourceType(event.target.value)
                    }
                    placeholder="Optional LINE stickerResourceType"
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label className="block space-y-1.5 xl:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Pack title</span>
                  <input
                    value={linePackTitle}
                    onChange={(event) => setLinePackTitle(event.target.value)}
                    placeholder="Optional pack title"
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              </>
            ) : null}

            {formError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 xl:col-span-2">
                {formError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60 xl:col-span-2"
            >
              {saving ? "Saving..." : "Save to workspace"}
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-[1.75rem] border border-slate-200/90 bg-white p-6 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.45)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Saved stickers</h2>
                <p className="text-sm text-slate-500">
                  These are the provider sticker references saved for this workspace.
                  Native provider pack browsing can come later.
                </p>
              </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {items.length} saved
            </span>
          </div>

          {loading ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="h-36 animate-pulse rounded-3xl bg-slate-100"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
              No stickers saved for this workspace yet.
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {channelOptions.map((groupChannel) => {
                const groupItems = groupedItems[groupChannel];
                if (!groupItems.length) {
                  return null;
                }

                return (
                  <div key={groupChannel}>
                    <div className="mb-3 flex items-center gap-2">
                      <img
                        src={PlatformIcons.getIconUrl(groupChannel)}
                        alt=""
                        className="h-5 w-5"
                        aria-hidden="true"
                      />
                      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {channelLabels[groupChannel]}
                      </h3>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {groupItems.map((item) => (
                        <article
                          key={item._id}
                          className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <StickerPreviewCard item={item} />
                            <button
                              type="button"
                              onClick={() => void handleDelete(item._id)}
                              disabled={deletingId === item._id}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Delete sticker"
                              aria-label="Delete sticker"
                            >
                              <DeleteOutlineRoundedIcon
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </button>
                          </div>

                          <div className="mt-4 space-y-1">
                            <h4 className="truncate text-sm font-semibold text-slate-900">
                              {item.label}
                            </h4>
                            {item.description ? (
                              <p className="text-xs text-slate-500">{item.description}</p>
                            ) : null}
                          </div>

                          <div className="mt-4 space-y-1 text-[11px] text-slate-500">
                            <p className="break-all">sticker: {item.platformStickerId}</p>
                            {item.providerMeta?.line?.packageId ? (
                              <p>package: {item.providerMeta.line.packageId}</p>
                            ) : null}
                            {item.providerMeta?.telegram?.thumbnailFileId ? (
                              <p className="break-all">
                                thumb: {item.providerMeta.telegram.thumbnailFileId}
                              </p>
                            ) : null}
                            {item.updatedAt ? (
                              <p>
                                updated{" "}
                                {new Date(item.updatedAt).toLocaleString([], {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </p>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
