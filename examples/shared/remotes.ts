import { clientEvent, defineRemotes, s, serverEvent } from "@skyzwrl/remotes";

export const UPGRADES = ["speed", "magnet", "double coins"] as const;
export type Upgrade = (typeof UPGRADES)[number];

export const remotes = defineRemotes({
	buyUpgrade: clientEvent(s.literal(...UPGRADES), { rateLimit: { perSecond: 2, burst: 3 } }),
	coinsChanged: serverEvent<[coins: number]>(),
	upgradesChanged: serverEvent<[upgrades: Upgrade[]]>(),
});
