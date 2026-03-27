import { Channel } from "../../types/models";
import { PlatformIcons } from "../../utils/platform-icons";

const channelMeta: Record<
  Channel,
  {
    label: string;
    className: string;
  }
> = {
  facebook: {
    label: "messenger",
    className: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  instagram: {
    label: "instagram",
    className: "bg-pink-50 text-pink-700 ring-pink-200",
  },
  telegram: {
    label: "telegram",
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  viber: {
    label: "viber",
    className: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  tiktok: {
    label: "tiktok",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  line: {
    label: "line",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  website: {
    label: "website",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
};

export function ChannelBadge({ channel }: { channel: Channel }) {
  const meta = channelMeta[channel];
  const iconUrl = PlatformIcons.getIconUrl(channel);

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ${meta.className}`}
    >
      <img
        src={iconUrl}
        alt=""
        aria-hidden="true"
        className="mr-1 h-3.5 w-3.5 object-contain"
      />
      {meta.label}
    </span>
  );
}