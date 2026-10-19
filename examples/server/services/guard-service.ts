import { CollectionService, Players } from "@rbxts/services";
import { OnInit, OnTick } from "@skyzwrl/framework";
import { createMachine } from "@skyzwrl/state-machine";

const SIGHT_RANGE = 40;

interface Guard {
	readonly humanoid: Humanoid;
	readonly root: BasePart;
	readonly post: Vector3;
	target?: BasePart;
}

function createBrain(guard: Guard) {
	return createMachine({
		initial: "guarding",
		context: guard,
		states: {
			guarding: {
				on: { spotted: { target: "chasing", action: (g, part) => (g.target = part as BasePart) } },
			},
			chasing: {
				on: { lost: "returning" },
				update: (g) => g.humanoid.MoveTo(g.target!.Position),
				after: { seconds: 12, target: "returning" },
			},
			returning: {
				enter: (g) => {
					g.target = undefined;
					g.humanoid.MoveTo(g.post);
				},
				on: {
					spotted: { target: "chasing", action: (g, part) => (g.target = part as BasePart) },
					arrived: "guarding",
				},
			},
		},
	});
}

function nearestPlayer(origin: Vector3): BasePart | undefined {
	let nearest: BasePart | undefined;
	let nearestDistance = SIGHT_RANGE;
	for (const player of Players.GetPlayers()) {
		const root = player.Character?.FindFirstChild("HumanoidRootPart");
		if (root?.IsA("BasePart")) {
			const distance = root.Position.sub(origin).Magnitude;
			if (distance < nearestDistance) {
				nearest = root;
				nearestDistance = distance;
			}
		}
	}
	return nearest;
}

export class GuardService implements OnInit, OnTick {
	private readonly brains = new Map<Model, ReturnType<typeof createBrain>>();

	public onInit(): void {
		for (const model of CollectionService.GetTagged("Guard")) {
			if (!model.IsA("Model")) {
				continue;
			}
			const humanoid = model.FindFirstChildOfClass("Humanoid");
			const root = model.PrimaryPart;
			if (humanoid !== undefined && root !== undefined) {
				this.brains.set(model, createBrain({ humanoid, root, post: root.Position }));
			}
		}
	}

	public onTick(deltaTime: number): void {
		for (const [, brain] of this.brains) {
			const guard = brain.context;
			const seen = nearestPlayer(guard.root.Position);
			if (seen !== undefined) {
				brain.send("spotted", seen);
			} else if (brain.is("chasing")) {
				brain.send("lost");
			} else if (brain.is("returning") && guard.root.Position.sub(guard.post).Magnitude < 3) {
				brain.send("arrived");
			}
			brain.update(deltaTime);
		}
	}
}
