/// <reference types="@rbxts/testez/globals" />

import { resolveOrder } from "../order";
import { Provider, nameOf } from "../provider";

class Data {}
class Remotes {}
class Combat {
	public static readonly dependencies = [Data, Remotes];
}
class Hud {
	public static readonly dependencies = [Combat];
}

function names(order: Provider[]): string {
	return order.map(nameOf).join(",");
}

export = () => {
	describe("resolveOrder", () => {
		it("puts dependencies before the providers that need them", () => {
			expect(names(resolveOrder([Hud, Combat, Remotes, Data]))).to.equal("Remotes,Data,Combat,Hud");
		});

		it("keeps registration order between providers that don't depend on each other", () => {
			expect(names(resolveOrder([Remotes, Data]))).to.equal("Remotes,Data");
			expect(names(resolveOrder([Data, Remotes]))).to.equal("Data,Remotes");
		});

		it("lets an earlier registration go first once its dependencies are ready", () => {
			class Inventory {}
			class Shop {
				public static readonly dependencies = [Inventory];
			}
			class Music {}

			expect(names(resolveOrder([Shop, Music, Inventory]))).to.equal("Music,Inventory,Shop");
		});

		it("gives the same order every time", () => {
			const first = names(resolveOrder([Hud, Data, Combat, Remotes]));
			for (let attempt = 0; attempt < 5; attempt++) {
				expect(names(resolveOrder([Hud, Data, Combat, Remotes]))).to.equal(first);
			}
		});

		it("waits for every dependency even when one is listed twice", () => {
			class Twice {
				public static readonly dependencies = [Data, Data, Remotes];
			}

			expect(names(resolveOrder([Data, Twice, Remotes]))).to.equal("Data,Remotes,Twice");
		});

		it("reports a cycle along with its path", () => {
			class Ammo {
				public static dependencies: Provider[] = [];
			}
			class Gun {
				public static dependencies: Provider[] = [Ammo];
			}
			class Reload {
				public static dependencies: Provider[] = [Gun];
			}
			Ammo.dependencies = [Reload];

			expect(() => resolveOrder([Data, Ammo, Gun, Reload])).to.throw(
				"dependency cycle: Ammo -> Reload -> Gun -> Ammo",
			);
		});

		it("names both classes when a dependency was never added", () => {
			expect(() => resolveOrder([Combat, Data])).to.throw("Combat depends on Remotes, which was never added");
		});
	});
};
