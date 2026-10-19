import { Provider, nameOf } from "./provider";

function findCycle(unresolved: Set<Provider>, start: Provider): Provider[] {
	const path = new Array<Provider>();
	const seen = new Map<Provider, number>();
	let current = start;
	while (!seen.has(current)) {
		seen.set(current, path.size());
		path.push(current);
		// every unresolved provider waits on at least one other unresolved one, so this always finds a next step
		current = current.dependencies!.find((dependency) => unresolved.has(dependency as Provider)) as Provider;
	}
	const cycle = path.filter((_, index) => index >= seen.get(current)!);
	cycle.push(current);
	return cycle;
}

// dependencies always come before their dependents; among providers that are ready at the same time
// the one added first goes first, so the order only changes when the registrations do
export function resolveOrder(providers: ReadonlyArray<Provider>): Provider[] {
	const index = new Map<Provider, number>();
	providers.forEach((provider, position) => index.set(provider, position));

	const waitingOn = new Map<Provider, number>();
	const dependents = new Map<Provider, Provider[]>();
	for (const provider of providers) {
		const unique = new Set<Provider>();
		for (const dependency of provider.dependencies ?? []) {
			const required = dependency as Provider;
			if (!index.has(required)) {
				error(`${nameOf(provider)} depends on ${nameOf(required)}, which was never added`, 3);
			}
			if (!unique.has(required)) {
				unique.add(required);
				let list = dependents.get(required);
				if (list === undefined) {
					list = [];
					dependents.set(required, list);
				}
				list.push(provider);
			}
		}
		waitingOn.set(provider, unique.size());
	}

	const ready = providers.filter((provider) => waitingOn.get(provider) === 0);
	const order = new Array<Provider>();
	while (ready.size() > 0) {
		let earliest = 0;
		for (let candidate = 1; candidate < ready.size(); candidate++) {
			if (index.get(ready[candidate])! < index.get(ready[earliest])!) {
				earliest = candidate;
			}
		}
		const provider = ready.unorderedRemove(earliest)!;
		order.push(provider);

		for (const dependent of dependents.get(provider) ?? []) {
			const count = waitingOn.get(dependent)! - 1;
			waitingOn.set(dependent, count);
			if (count === 0) {
				ready.push(dependent);
			}
		}
	}

	if (order.size() < providers.size()) {
		const unresolved = new Set(providers.filter((provider) => waitingOn.get(provider)! > 0));
		const first = providers.find((provider) => unresolved.has(provider))!;
		const cycle = findCycle(unresolved, first).map(nameOf).join(" -> ");
		error(`dependency cycle: ${cycle}`, 3);
	}

	return order;
}
