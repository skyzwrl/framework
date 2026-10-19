import { RunService } from "@rbxts/services";
import { Hook, OnInit, OnPhysics, OnRender, OnStart, OnStop, OnTick, implementsHook } from "./lifecycle";
import { resolveOrder } from "./order";
import { Checked, Constructor, Provider, nameOf } from "./provider";

export interface FrameConnection {
	Disconnect(): void;
}

export interface FrameSignal {
	Connect(callback: (deltaTime: number) => void): FrameConnection;
}

export type ErrorHandler = (err: unknown, provider: string, hook: Hook) => void;

export interface FrameworkOptions {
	onError?: ErrorHandler;
	/** defaults to RunService.Heartbeat */
	tick?: FrameSignal;
	/** defaults to RunService.PreSimulation */
	physics?: FrameSignal;
	/** defaults to RunService.PreRender on the client, there is no render step on the server */
	render?: FrameSignal;
}

type State = "idle" | "starting" | "started" | "failed" | "stopped";

// rethrown on its own thread so the error and its traceback still reach the output without
// stopping the other providers' hooks
function rethrow(err: unknown, provider: string, hook: Hook): void {
	task.spawn(error, `${provider}.${hook}: ${tostring(err)}`, 0);
}

function traceback(err: unknown): string {
	return debug.traceback(tostring(err), 2);
}

function construct(provider: Provider, dependencies: object[]): object {
	return new (provider as unknown as new (...args: object[]) => object)(...dependencies);
}

function init(target: OnInit): void {
	target.onInit();
}

function start(target: OnStart): void {
	target.onStart();
}

function stop(target: OnStop): void {
	target.onStop();
}

function tick(target: OnTick, deltaTime: number): void {
	target.onTick(deltaTime);
}

function physics(target: OnPhysics, deltaTime: number): void {
	target.onPhysics(deltaTime);
}

function render(target: OnRender, deltaTime: number): void {
	target.onRender(deltaTime);
}

export class Framework {
	private readonly providers = new Array<Provider>();
	private readonly instances = new Map<Provider, object>();
	private readonly names = new Map<object, string>();
	private readonly connections = new Array<FrameConnection>();
	private readonly onError: ErrorHandler;
	private order = new Array<Provider>();
	private state: State = "idle";

	public constructor(private readonly options: FrameworkOptions = {}) {
		this.onError = options.onError ?? rethrow;
	}

	public add<P extends Provider[]>(...providers: [...P] & { [K in keyof P]: Checked<P[K]> }): this {
		if (this.state !== "idle") {
			error("providers have to be added before start()", 2);
		}
		for (const provider of providers as Provider[]) {
			if (this.providers.includes(provider)) {
				error(`${nameOf(provider)} was added twice`, 2);
			}
			this.providers.push(provider);
		}
		return this;
	}

	public start(): void {
		if (this.state !== "idle") {
			error("start() can only be called once", 2);
		}
		this.state = "starting";

		const order = resolveOrder(this.providers);
		this.order = order;

		for (const provider of order) {
			const name = nameOf(provider);
			const dependencies = new Array<object>();
			for (const dependency of provider.dependencies ?? []) {
				dependencies.push(this.instances.get(dependency as Provider)!);
			}

			const [constructed, instance] = xpcall(construct, traceback, provider, dependencies);
			if (!constructed) {
				this.state = "failed";
				error(`${name} failed to construct: ${instance}`, 0);
			}
			this.instances.set(provider, instance);
			this.names.set(instance, name);
		}

		for (const provider of order) {
			const instance = this.instances.get(provider)!;
			if (implementsHook<OnInit>(instance, "onInit")) {
				const [initialized, err] = xpcall(init, traceback, instance);
				if (!initialized) {
					this.state = "failed";
					error(`${nameOf(provider)}.onInit failed: ${err}`, 0);
				}
			}
		}

		this.bindFrameHooks();
		this.state = "started";

		for (const provider of order) {
			const instance = this.instances.get(provider)!;
			if (implementsHook<OnStart>(instance, "onStart")) {
				task.spawn(() => {
					const [started, err] = xpcall(start, traceback, instance);
					if (!started) {
						this.onError(err, nameOf(provider), "onStart");
					}
				});
			}
		}
	}

	public get<T extends object>(provider: Constructor<T>): T {
		if (this.state !== "started") {
			error(`get(${tostring(provider)}) needs a started framework`, 2);
		}
		const instance = this.instances.get(provider as Provider);
		if (instance === undefined) {
			error(`${tostring(provider)} was never added`, 2);
		}
		return instance as T;
	}

	public stop(): void {
		if (this.state === "idle") {
			error("stop() was called before start()", 2);
		} else if (this.state !== "started") {
			return;
		}
		this.state = "stopped";

		for (const connection of this.connections) {
			connection.Disconnect();
		}
		this.connections.clear();

		for (let index = this.order.size() - 1; index >= 0; index--) {
			const provider = this.order[index];
			const instance = this.instances.get(provider)!;
			if (implementsHook<OnStop>(instance, "onStop")) {
				const [stopped, err] = xpcall(stop, traceback, instance);
				if (!stopped) {
					this.onError(err, nameOf(provider), "onStop");
				}
			}
		}
	}

	private bindFrameHooks(): void {
		const tickers = new Array<OnTick>();
		const simulators = new Array<OnPhysics>();
		const renderers = new Array<OnRender>();
		for (const provider of this.order) {
			const instance = this.instances.get(provider)!;
			if (implementsHook<OnTick>(instance, "onTick")) {
				tickers.push(instance);
			}
			if (implementsHook<OnPhysics>(instance, "onPhysics")) {
				simulators.push(instance);
			}
			if (implementsHook<OnRender>(instance, "onRender")) {
				renderers.push(instance);
			}
		}

		const options = this.options;
		let renderSignal = options.render;
		if (renderSignal === undefined && !renderers.isEmpty()) {
			if (!RunService.IsClient()) {
				this.state = "failed";
				error(`${this.names.get(renderers[0])} implements onRender, which only runs on the client`, 0);
			}
			renderSignal = RunService.PreRender;
		}

		this.bind(tickers, tick, "onTick", options.tick ?? RunService.Heartbeat);
		this.bind(simulators, physics, "onPhysics", options.physics ?? RunService.PreSimulation);
		if (renderSignal !== undefined) {
			this.bind(renderers, render, "onRender", renderSignal);
		}
	}

	private bind<T extends object>(
		targets: T[],
		run: (target: T, deltaTime: number) => void,
		hook: Hook,
		signal: FrameSignal,
	): void {
		if (targets.isEmpty()) {
			return;
		}
		const names = this.names;
		const onError = this.onError;
		this.connections.push(
			signal.Connect((deltaTime) => {
				for (const target of targets) {
					const [ok, err] = xpcall(run, traceback, target, deltaTime);
					if (!ok) {
						onError(err, names.get(target)!, hook);
					}
				}
			}),
		);
	}
}
