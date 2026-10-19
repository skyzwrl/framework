import { Checked, ConstructorDoesNotMatchDependencies } from "../provider";

// compile time only, the build fails if any of these stop holding

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

export declare class Data {
	public readonly coins: number;
}

export declare class Remotes {
	public readonly folder: Folder;
}

export declare class Combat {
	public static readonly dependencies: readonly [typeof Data, typeof Remotes];
	public constructor(data: Data, remotes: Remotes);
}

export declare class Swapped {
	public static readonly dependencies: readonly [typeof Remotes, typeof Data];
	public constructor(data: Data, remotes: Remotes);
}

export declare class Undeclared {
	public constructor(data: Data);
}

export declare class MissingParameter {
	public static readonly dependencies: readonly [typeof Data];
	public constructor(data: Data, remotes: Remotes);
}

export declare class ExtraDependency {
	public static readonly dependencies: readonly [typeof Data, typeof Remotes];
	public constructor(data: Data);
}

export type Assertions = [
	Expect<Equals<Checked<typeof Data>, typeof Data>>,
	Expect<Equals<Checked<typeof Combat>, typeof Combat>>,
	Expect<Equals<Checked<typeof ExtraDependency>, typeof ExtraDependency>>,
	Expect<Equals<Checked<typeof Swapped>, ConstructorDoesNotMatchDependencies>>,
	Expect<Equals<Checked<typeof Undeclared>, ConstructorDoesNotMatchDependencies>>,
	Expect<Equals<Checked<typeof MissingParameter>, ConstructorDoesNotMatchDependencies>>,
];
