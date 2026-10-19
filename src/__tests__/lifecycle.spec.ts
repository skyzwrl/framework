/// <reference types="@rbxts/testez/globals" />

import { Framework } from "../framework";
import { Hook, OnInit, OnStart, OnStop } from "../lifecycle";
import { ManualSignal } from "./manual-signal";

export = () => {
	let log: string[];
	let errors: string[];

	function createFramework(): Framework {
		return new Framework({
			tick: new ManualSignal(),
			physics: new ManualSignal(),
			onError: (err, provider, hook: Hook) => errors.push(`${provider}.${hook}: ${err}`),
		});
	}

	beforeEach(() => {
		log = [];
		errors = [];
	});

	class Data implements OnInit, OnStart, OnStop {
		public readonly coins = 10;

		public onInit(): void {
			log.push("init Data");
		}

		public onStart(): void {
			log.push("start Data");
		}

		public onStop(): void {
			log.push("stop Data");
		}
	}

	class Combat implements OnInit, OnStart, OnStop {
		public static readonly dependencies = [Data] as const;

		public constructor(public readonly data: Data) {}

		public onInit(): void {
			log.push(`init Combat (${this.data.coins} coins)`);
		}

		public onStart(): void {
			log.push("start Combat");
		}

		public onStop(): void {
			log.push("stop Combat");
		}
	}

	describe("start", () => {
		it("constructs each provider once with its dependencies", () => {
			const app = createFramework().add(Combat, Data);
			app.start();

			expect(app.get(Combat).data).to.equal(app.get(Data));
		});

		it("runs every onInit in dependency order before any onStart", () => {
			const app = createFramework().add(Combat, Data);
			app.start();

			expect(log.join(",")).to.equal("init Data,init Combat (10 coins),start Data,start Combat");
		});

		it("aborts and names the provider when onInit throws", () => {
			class Broken implements OnInit {
				public static readonly dependencies = [Data] as const;

				public constructor(public readonly data: Data) {}

				public onInit(): void {
					throw "datastore down";
				}
			}
			class Late implements OnInit, OnStart {
				public static readonly dependencies = [Broken] as const;

				public constructor(public readonly broken: Broken) {}

				public onInit(): void {
					log.push("init Late");
				}

				public onStart(): void {
					log.push("start Late");
				}
			}

			const app = createFramework().add(Data, Broken, Late);
			expect(() => app.start()).to.throw("Broken.onInit failed");
			expect(() => app.start()).to.throw("start() can only be called once");
			expect(log.join(",")).to.equal("init Data");
			expect(() => app.get(Data)).to.throw("needs a started framework");
		});

		it("aborts and names the provider when a constructor throws", () => {
			class Exploding {
				public constructor() {
					throw "bad config";
				}
			}

			const app = createFramework().add(Data, Exploding);
			expect(() => app.start()).to.throw("Exploding failed to construct");
			expect(log.size()).to.equal(0);
		});

		it("spawns onStart so a provider that yields doesn't hold up the rest", () => {
			let parked: thread | undefined;
			class Slow implements OnStart {
				public onStart(): void {
					log.push("slow begins");
					parked = coroutine.running();
					coroutine.yield();
					log.push("slow finishes");
				}
			}
			class Quick implements OnStart {
				public onStart(): void {
					log.push("quick");
				}
			}

			const app = createFramework().add(Slow, Quick);
			app.start();
			expect(log.join(",")).to.equal("slow begins,quick");

			task.spawn(parked!);
			expect(log.join(",")).to.equal("slow begins,quick,slow finishes");
		});

		it("lets onStart use get on any provider", () => {
			let found: Data | undefined;
			class Reader implements OnStart {
				public onStart(): void {
					found = app.get(Data);
				}
			}

			const app = createFramework().add(Data, Reader);
			app.start();

			expect(found).to.equal(app.get(Data));
		});

		it("reports onStart errors through onError and keeps starting the others", () => {
			class Faulty implements OnStart {
				public onStart(): void {
					throw "missing folder";
				}
			}

			const app = createFramework().add(Faulty, Data);
			app.start();

			expect(errors.size()).to.equal(1);
			expect(errors[0].find("Faulty.onStart: ", 1, true)[0]).to.equal(1);
			expect(errors[0].find("missing folder", 1, true)[0]).to.be.ok();
			expect(log.join(",")).to.equal("init Data,start Data");
		});
	});

	describe("registration", () => {
		it("rejects the same provider twice", () => {
			expect(() => createFramework().add(Data, Data)).to.throw("Data was added twice");
		});

		it("rejects providers added after start", () => {
			const app = createFramework().add(Data);
			app.start();

			expect(() => app.add(Combat)).to.throw("providers have to be added before start()");
		});

		it("fails start when a dependency was never added", () => {
			const app = createFramework().add(Combat);

			expect(() => app.start()).to.throw("Combat depends on Data, which was never added");
		});
	});

	describe("get", () => {
		it("errors before start", () => {
			const app = createFramework().add(Data);

			expect(() => app.get(Data)).to.throw("get(Data) needs a started framework");
		});

		it("errors for a class that was never added", () => {
			class Stranger {}
			const app = createFramework().add(Data);
			app.start();

			expect(() => app.get(Stranger)).to.throw("Stranger was never added");
		});
	});

	describe("stop", () => {
		it("runs onStop in reverse dependency order", () => {
			const app = createFramework().add(Combat, Data);
			app.start();
			log.clear();
			app.stop();

			expect(log.join(",")).to.equal("stop Combat,stop Data");
		});

		it("reports onStop errors and still stops the rest", () => {
			class Stubborn implements OnStop {
				public static readonly dependencies = [Data] as const;

				public constructor(public readonly data: Data) {}

				public onStop(): void {
					throw "still saving";
				}
			}

			const app = createFramework().add(Data, Stubborn);
			app.start();
			log.clear();
			app.stop();

			expect(errors.size()).to.equal(1);
			expect(errors[0].find("Stubborn.onStop: ", 1, true)[0]).to.equal(1);
			expect(log.join(",")).to.equal("stop Data");
		});

		it("errors before start and does nothing the second time", () => {
			const app = createFramework().add(Data);
			expect(() => app.stop()).to.throw("stop() was called before start()");

			app.start();
			app.stop();
			app.stop();
			expect(log.filter((line) => line === "stop Data").size()).to.equal(1);
		});
	});
};
