import * as dotenv from "dotenv";
import Game from "./src/game.js";


async function getAdventurerStatus(advId) {
	return (game.ADVENTURER_STATUS[(await getAdventurerById(advId)).adventurer.Status.toNumber()]);
}

dotenv.config({path: "./.env." + process.argv[2]});

const adventurerId = Number(process.argv[3]);

const game = new Game(adventurerId, process.env.ACC_ADDR, process.env.PRIV_KEY);

game.start();