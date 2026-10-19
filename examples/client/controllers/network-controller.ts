import { createClient } from "@skyzwrl/remotes";
import { remotes } from "../../shared/remotes";

export class NetworkController {
	public readonly remotes = createClient(remotes);
}
