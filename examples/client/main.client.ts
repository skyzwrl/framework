import { Framework } from "@skyzwrl/framework";
import { NetworkController } from "./controllers/network-controller";
import { PickupController } from "./controllers/pickup-controller";
import { ShopController } from "./controllers/shop-controller";
import { WalletController } from "./controllers/wallet-controller";

new Framework().add(NetworkController, WalletController, ShopController, PickupController).start();
