/// <reference types="@rbxts/testez/globals" />

import { RunService } from "@rbxts/services";
import { Framework } from "../framework";
import { OnPhysics, OnRender, OnTick } from "../lifecycle";
import { ManualSignal } from "./manual-signal";

export = () => {
	let tick: ManualSignal;
	let physics: ManualSignal;
	let render: ManualSignal;
	let calls: string[];
	let errors: string[];

	function createFramework(withRender = true): Framework {
		return new Framework({
			tick,
			physics,
			render: withRender ? render : undefined,
			onError: (err, provider, hook) => errors.push(`${provider}.${hook}: ${err}`),
		});
	}

	beforeEach(() => {
		tick = new ManualSignal();
		physics = new ManualSignal();
		render = new ManualSignal();
		calls = [];
		errors = [];
	});

	class Mover implements OnTick, OnPhysics, OnRender {
		public onTick(deltaTime: number): void {
			calls.push(`tick ${deltaTime}`);
		}

		public onPhysics(deltaTime: number): void {
			calls.push(`physics ${deltaTime}`);
		}

		public onRender(deltaTime: number): void {
			calls.push(`render ${deltaTime}`);
		}
	}

	class Clock implements OnTick {
		public static readonly dependencies = [Mover] as const;

		public constructor(public readonly mover: Mover) {}

		public onTick(): void {
			calls.push("clock");
		}
	}

	it("passes delta time to each hook from its own signal", () => {
		const app = createFramework().add(Mover);
		app.start();

		tick.fire(0.5);
		physics.fire(0.25);
		render.fire(0.125);

		expect(calls.join(",")).to.equal("tick 0.5,physics 0.25,render 0.125");
	});

	it("runs hooks in dependency order through a single connection per signal", () => {
		const app = createFramework().add(Clock, Mover);
		app.start();
		tick.fire(1);

		expect(calls.join(",")).to.equal("tick 1,clock");
		expect(tick.listeners()).to.equal(1);
		expect(physics.listeners()).to.equal(1);
	});

	it("doesn't connect hooks nobody implements", () => {
		class Idle {}
		const app = createFramework().add(Idle);
		app.start();

		expect(tick.listeners()).to.equal(0);
		expect(physics.listeners()).to.equal(0);
		expect(render.listeners()).to.equal(0);
	});

	it("keeps calling the other providers when one hook throws", () => {
		class Faulty implements OnTick {
			public onTick(): void {
				throw "nil target";
			}
		}

		const app = createFramework().add(Faulty, Mover);
		app.start();
		tick.fire(0.1);
		tick.fire(0.1);

		expect(calls.join(",")).to.equal("tick 0.1,tick 0.1");
		expect(errors.size()).to.equal(2);
		expect(errors[0].find("Faulty.onTick: ", 1, true)[0]).to.equal(1);
		expect(errors[0].find("nil target", 1, true)[0]).to.be.ok();
	});

	it("disconnects every hook on stop", () => {
		const app = createFramework().add(Mover);
		app.start();
		app.stop();
		tick.fire(1);
		physics.fire(1);
		render.fire(1);

		expect(calls.size()).to.equal(0);
		expect(tick.listeners() + physics.listeners() + render.listeners()).to.equal(0);
	});

	it("refuses onRender on the server unless a render signal is given", () => {
		const app = createFramework(false).add(Mover);

		expect(() => app.start()).to.throw("Mover implements onRender, which only runs on the client");
		expect(tick.listeners() + physics.listeners()).to.equal(0);
	});

	it("falls back to RunService.Heartbeat", () => {
		let ticks = 0;
		class Counter implements OnTick {
			public onTick(): void {
				ticks += 1;
			}
		}

		const app = new Framework().add(Counter);
		app.start();
		for (let frame = 0; frame < 10 && ticks === 0; frame++) {
			RunService.Heartbeat.Wait();
		}
		app.stop();

		expect(ticks > 0).to.equal(true);
	});
};
