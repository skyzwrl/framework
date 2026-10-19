import { Players } from "@rbxts/services";
import { OnInit, OnStop } from "@skyzwrl/framework";
import { Session, SessionStore } from "@skyzwrl/session-store";
import { Signal } from "@skyzwrl/signal";
import { Upgrade } from "../../shared/remotes";

const TEMPLATE = {
	coins: 0,
	upgrades: new Array<Upgrade>(),
};

export type PlayerData = typeof TEMPLATE;

export class DataService implements OnInit, OnStop {
	public readonly loaded = new Signal<[player: Player, data: PlayerData]>();

	private readonly store = new SessionStore({ name: "PlayerData", template: TEMPLATE });
	private readonly sessions = new Map<Player, Session<PlayerData>>();

	public onInit(): void {
		Players.PlayerAdded.Connect((player) => this.load(player));
		Players.PlayerRemoving.Connect((player) => this.release(player));
		for (const player of Players.GetPlayers()) {
			task.spawn(() => this.load(player));
		}
	}

	public onStop(): void {
		this.store.releaseAllAsync();
	}

	public getData(player: Player): PlayerData | undefined {
		return this.sessions.get(player)?.data;
	}

	private load(player: Player): void {
		const result = this.store.loadAsync(`player_${player.UserId}`, [player.UserId]);
		if (!result.success) {
			player.Kick(
				result.reason === "Locked" ? "your data is still saving, rejoin in a moment" : "couldn't load data",
			);
			return;
		} else if (!player.IsDescendantOf(Players)) {
			result.session.releaseAsync();
			return;
		}

		this.sessions.set(player, result.session);
		this.loaded.fire(player, result.session.data);
	}

	private release(player: Player): void {
		this.sessions.get(player)?.releaseAsync();
		this.sessions.delete(player);
	}
}
