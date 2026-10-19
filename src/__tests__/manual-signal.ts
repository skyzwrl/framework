import { FrameConnection, FrameSignal } from "../framework";

class ManualConnection implements FrameConnection {
	public constructor(
		private readonly signal: ManualSignal,
		private readonly callback: (deltaTime: number) => void,
	) {}

	public Disconnect(): void {
		this.signal.remove(this.callback);
	}
}

export class ManualSignal implements FrameSignal {
	private readonly callbacks = new Array<(deltaTime: number) => void>();

	public Connect(callback: (deltaTime: number) => void): FrameConnection {
		this.callbacks.push(callback);
		return new ManualConnection(this, callback);
	}

	public remove(callback: (deltaTime: number) => void): void {
		const index = this.callbacks.indexOf(callback);
		if (index !== -1) {
			this.callbacks.remove(index);
		}
	}

	public fire(deltaTime: number): void {
		for (const callback of table.clone(this.callbacks)) {
			callback(deltaTime);
		}
	}

	public listeners(): number {
		return this.callbacks.size();
	}
}
