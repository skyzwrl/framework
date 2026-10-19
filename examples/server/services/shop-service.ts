import { OnStart } from "@skyzwrl/framework";
import { Upgrade } from "../../shared/remotes";
import { DataService } from "./data-service";
import { NetworkService } from "./network-service";

const PRICES: Record<Upgrade, number> = {
	speed: 100,
	magnet: 250,
	"double coins": 1000,
};

export class ShopService implements OnStart {
	public static readonly dependencies = [DataService, NetworkService] as const;

	public constructor(
		private readonly data: DataService,
		private readonly network: NetworkService,
	) {}

	public onStart(): void {
		const remotes = this.network.remotes;

		this.data.loaded.connect((player, data) => {
			remotes.coinsChanged.fire(player, data.coins);
			remotes.upgradesChanged.fire(player, data.upgrades);
		});

		remotes.buyUpgrade.connect((player, upgrade) => {
			const data = this.data.getData(player);
			const price = PRICES[upgrade];
			if (data === undefined || data.upgrades.includes(upgrade) || data.coins < price) {
				return;
			}

			data.coins -= price;
			data.upgrades.push(upgrade);
			remotes.coinsChanged.fire(player, data.coins);
			remotes.upgradesChanged.fire(player, data.upgrades);
		});
	}
}
