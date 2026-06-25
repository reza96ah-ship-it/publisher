"use client";

import { channelOptions, normalizeChannels } from "../lib/channels";
import { StatusToken } from "./workspace-ui";

type ChannelBadgesProps = {
  platform?: string | null;
  compact?: boolean;
};

export function ChannelBadges({ platform, compact = false }: ChannelBadgesProps) {
  const channels = normalizeChannels(platform);

  return (
    <>
      {channels.map((channel) => {
        const option = channelOptions.find((item) => item.value === channel) ?? channelOptions[0];
        const Icon = option.icon;
        return (
          <StatusToken key={channel} tone={option.tone} className="gap-1">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {compact ? option.shortLabel : option.label}
          </StatusToken>
        );
      })}
    </>
  );
}

