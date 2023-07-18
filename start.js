import * as dotenv from "dotenv";
import Game from "./src/game.js";

dotenv.config({path: "./.env." + process.argv[2]});

const adventurerId = Number(process.argv[3]);

const game = new Game(adventurerId, process.env.ACC_ADDR, process.env.PRIV_KEY);

game.start();