import { Channel } from "../../types/models";

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
};

export function ChannelBadge({ channel }: { channel: Channel }) {
  const meta = channelMeta[channel];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}