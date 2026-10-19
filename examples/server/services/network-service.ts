import { createServer } from "@skyzwrl/remotes";
import { remotes } from "../../shared/remotes";

export class NetworkService {
	public readonly remotes = createServer(remotes, {
		onRejected: ({ player, remote, kind }) => warn(`${player.Name} sent a bad ${remote} (${kind})`),
	});
}
