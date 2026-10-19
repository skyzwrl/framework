export interface OnInit {
	onInit(): void;
}

export interface OnStart {
	onStart(): void;
}

export interface OnTick {
	onTick(deltaTime: number): void;
}

export interface OnPhysics {
	onPhysics(deltaTime: number): void;
}

export interface OnRender {
	onRender(deltaTime: number): void;
}

export interface OnStop {
	onStop(): void;
}

export type Hook = "onInit" | "onStart" | "onTick" | "onPhysics" | "onRender" | "onStop";

export function implementsHook<T extends object>(value: object, hook: keyof T & Hook): value is T {
	return typeIs((value as Record<string, unknown>)[hook], "function");
}
