export type Constructor<T extends object = object> = new (...args: never[]) => T;

export interface Provider<T extends object = object> {
	readonly dependencies?: ReadonlyArray<Constructor>;
	new (...args: never[]): T;
}

type InstanceOf<C> = C extends Constructor<infer T> ? T : never;
type InstancesOf<D extends ReadonlyArray<Constructor>> = { -readonly [K in keyof D]: InstanceOf<D[K]> };

export interface ConstructorDoesNotMatchDependencies {
	readonly "the constructor must take its static dependencies, in order": never;
}

// C when its constructor accepts instances of its declared dependencies in order, otherwise a type no
// class satisfies, so add() fails to compile on the offending argument
export type Checked<C> = C extends { readonly dependencies: infer D extends ReadonlyArray<Constructor> }
	? C extends new (...args: InstancesOf<D>) => object
		? C
		: ConstructorDoesNotMatchDependencies
	: C extends new () => object
		? C
		: ConstructorDoesNotMatchDependencies;

export function nameOf(provider: Provider): string {
	return tostring(provider);
}
