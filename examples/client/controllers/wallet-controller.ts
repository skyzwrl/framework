import { OnInit } from "@skyzwrl/framework";
import { Signal } from "@skyzwrl/signal";
import { Upgrade } from "../../shared/remotes";
import { NetworkController } from "./network-controller";

export class WalletController implements OnInit {
	public static readonly dependencies = [NetworkController] as const;

	public readonly changed = new Signal<[coins: number]>();

	private coins = 0;
	private upgrades = new Array<Upgrade>();

	public constructor(private readonly network: NetworkController) {}

	public onInit(): void {
		const remotes = this.network.remotes;
		remotes.coinsChanged.connect((coins) => {
			this.coins = coins;
			this.changed.fire(coins);
		});
		remotes.upgradesChanged.connect((upgrades) => (this.upgrades = upgrades));
	}

	public getCoins(): number {
		return this.coins;
	}

	public owns(upgrade: Upgrade): boolean {
		return this.upgrades.includes(upgrade);
	}
}
