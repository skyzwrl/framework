import { Framework } from "@skyzwrl/framework";
import { DataService } from "./services/data-service";
import { GuardService } from "./services/guard-service";
import { NetworkService } from "./services/network-service";
import { ShopService } from "./services/shop-service";

const app = new Framework().add(DataService, NetworkService, ShopService, GuardService);
app.start();

// stops in reverse dependency order, so the shop is done with player data before it gets released
game.BindToClose(() => app.stop());

// dependencies are checked against the constructor, a mismatch doesn't compile:
//
//   class BrokenService {
//       static readonly dependencies = [NetworkService, DataService] as const;
//       constructor(private readonly data: DataService, private readonly network: NetworkService) {}
//   }
//   app.add(BrokenService); // Argument of type '[typeof BrokenService]' is not assignable to parameter
//                           // of type '[typeof BrokenService] & [ConstructorDoesNotMatchDependencies]'
