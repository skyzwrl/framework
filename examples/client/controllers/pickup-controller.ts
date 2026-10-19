import { CollectionService } from "@rbxts/services";
import { OnRender } from "@skyzwrl/framework";

const SPIN_SPEED = math.rad(90);
const BOB_HEIGHT = 0.5;

// purely cosmetic, so it runs on the client every rendered frame instead of replicating from the server
export class PickupController implements OnRender {
	private elapsed = 0;

	public onRender(deltaTime: number): void {
		this.elapsed += deltaTime;
		const offset = new CFrame(0, math.sin(this.elapsed * 2) * BOB_HEIGHT, 0).mul(
			CFrame.Angles(0, this.elapsed * SPIN_SPEED, 0),
		);
		for (const pickup of CollectionService.GetTagged("Pickup")) {
			if (pickup.IsA("BasePart")) {
				const origin = pickup.GetAttribute("Origin");
				if (typeIs(origin, "CFrame")) {
					pickup.CFrame = origin.mul(offset);
				}
			}
		}
	}
}
