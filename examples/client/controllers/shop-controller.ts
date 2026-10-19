import { UserInputService } from "@rbxts/services";
import { OnStart } from "@skyzwrl/framework";
import { UPGRADES } from "../../shared/remotes";
import { NetworkController } from "./network-controller";
import { WalletController } from "./wallet-controller";

const KEYS: Enum.KeyCode[] = [Enum.KeyCode.One, Enum.KeyCode.Two, Enum.KeyCode.Three];

export class ShopController implements OnStart {
	public static readonly dependencies = [NetworkController, WalletController] as const;

	public constructor(
		private readonly network: NetworkController,
		private readonly wallet: WalletController,
	) {}

	public onStart(): void {
		UserInputService.InputBegan.Connect((input, processed) => {
			const slot = KEYS.indexOf(input.KeyCode);
			if (processed || slot === -1) {
				return;
			}
			const upgrade = UPGRADES[slot];
			if (!this.wallet.owns(upgrade)) {
				this.network.remotes.buyUpgrade.fire(upgrade);
			}
		});
	}
}
