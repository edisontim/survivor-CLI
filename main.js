import * as dotenv from "dotenv";
import * as fs from "fs";
import Game from "./src/game.js";


if (process.argv.length != 3) {
	console.log(`Usage: node main.js <adventurerId>`);
	process.exit(1);
}

const envPath = "./.env";
if (!fs.existsSync(envPath)) {
	console.log(`ENOENT: ${envPath}`);
	process.exit(ENOENT);
}

dotenv.config({path: envPath});

const adventurerId = Number(process.argv[2]);

const game = new Game(adventurerId, process.env.ACC_ADDR, process.env.PRIV_KEY);

game.start();