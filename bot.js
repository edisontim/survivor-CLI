import { Account, ec, Provider, Contract, json} from "starknet";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as readline from "readline";
import GameData from "./constants/gameData.js";

const mainContractAddr = "0x059daa60c4fbbb2866bbaf55b32916bd55d39243a2f97d78938fdfba79f1a4f2";
const beastsContractAddr = "0x00d4941e7c42c06437cff11b2f50933d38b19ffd6c9a317bbddcc836ca83f113";

const gameData = new GameData();

const EVENTS = {
	DISCOVERY: "0x32cbdf518aa1395df2b69a6a00662a683a8de526eda2c7ea88145ddfa53e4ed",
	LEVEL_UP: "0x16b747f083a5bc0eb62f1465891cc9b6ce061c09e77556f949348af4e7a608a",
	CREATE_BEAST: "0x3c1d06985ef07b174e37f912d604fbfd3e60d6b519abf5a9e95bed3090961c",
}

const STATS = {
	STRENGTH: 2,
	DEXTERITY: 3,
	VITALITY: 4,
	INTELLIGENCE: 5,
	WISDOM: 6,
	CHARISMA: 7,
}

const DISCOVERY_TYPES = {
	XP: "xp",
	BEAST: "beast",
	OBSTACLE: "obstacle",
	MONEY_HEALTH: "money and health",
}

async function getAdventurerHealth(advId) {
	const res = await survivorContract.call("get_adventurer_by_id", [[advId, 0]]);
	return (res[0].Health.toNumber());
}

function waitUserIntervention(query) {
    return new Promise(resolve => rl.question(query, ans => {
        resolve(ans);
    }))
}

async function executeContractFunction(contract, funcName, params) {
	let transactionResult = false;
	try {
		console.log(`${funcName} was invoked`);
		let invokeRes = await contract.invoke(funcName, params);
		transactionResult = await provider.waitForTransaction(invokeRes.transaction_hash);
		console.log(`Transaction hash: ${invokeRes.transaction_hash}`);
		
		while (transactionResult.status !== "ACCEPTED_ON_L2") {
			transactionResult = await provider.waitForTransaction(invokeRes.transaction_hash);
		}

		console.log(FgGreen + `Successful transaction: ${funcName}` + reset);

	} catch (err) {
		console.log(err);
		console.log(FgRed + "%s" + reset, 'Failed transaction: ' + funcName);
		await new Promise(resolve => setTimeout(resolve, 100000));
	}

	return transactionResult;
}

dotenv.config({path: "./.env." + process.argv[2]});

const rl = readline.createInterface({
	input: process.stdin,  // Read input from the command line
	output: process.stdout // Output text to the command line
});


const adventurerId = Number(process.argv[3]);

const provider = new Provider({ sequencer: { network: 'goerli-alpha' } })

const privateKey = process.env.PRIV_KEY;
const starkKeyPair = ec.getKeyPair(privateKey);
const accAddr = process.env.ACC_ADDR;
const account = new Account(provider, accAddr, starkKeyPair);

const survivorAbi = json.parse(fs.readFileSync("./contracts/survivor.json").toString("ascii"));
if (survivorAbi === undefined) { 
	throw new Error("no survivor abi.") 
};

const survivorContract = new Contract(survivorAbi, mainContractAddr, provider);
survivorContract.connect(account);

const beastsAbi = json.parse(fs.readFileSync("./contracts/beasts.json").toString("ascii"));
if (beastsAbi === undefined) { 
	throw new Error("no beasts abi.") 
};

const beastsContract = new Contract(beastsAbi, beastsContractAddr, provider);
beastsContract.connect(account);


const reset = "\x1b[0m";
const FgBlack = "\x1b[30m";
const FgRed = "\x1b[31m"
const FgGreen = "\x1b[32m"
const FgMagenta = "\x1b[35m"
const FgYellow = "\x1b[33m"


const DISCOVERY_TYPE_INDEX = 2;
const LEVEL_UP_INDEX = 2;
const ENTITY_ID_INDEX = 4;

const discovery = [DISCOVERY_TYPES.XP, DISCOVERY_TYPES.BEAST, DISCOVERY_TYPES.OBSTACLE, DISCOVERY_TYPES.MONEY_HEALTH];

const upgrades = [STATS.INTELLIGENCE, STATS.DEXTERITY , STATS.INTELLIGENCE , STATS.WISDOM , STATS.VITALITY , STATS.DEXTERITY , STATS.INTELLIGENCE];

let prevHealth = await getAdventurerHealth(adventurerId);
while (true) {
	console.log(FgMagenta + "\n%s" + reset, 'Triggering discovery');

	const transactionRes = await executeContractFunction(survivorContract, "explore", [[adventurerId, 0]]);
	if (transactionRes == false) {
		continue;
	}
	
	let currentHealth = await getAdventurerHealth(adventurerId);
	if (currentHealth < prevHealth) {
		prevHealth = currentHealth;
		console.log(FgRed + "adventurer lost some health! Down to " + prevHealth + reset);
	}

	// let occuredEvent;
	let discoveryType;
	console.log(transactionRes.events);

	// Reformat the transaction events
	let events = {};
	for (e of transactionRes.events) {
		events[e.keys[0]] = e.data;
	}

	if (events[EVENTS.LEVEL_UP]) {
		const levelReached = Number(events[EVENTS.LEVEL_UP][LEVEL_UP_INDEX]);
		console.log(FgGreen + `Leveled up to lvl ${levelReached} !` + reset);
		// const statToUpgrade = upgrades[levelReached - 2];
		
		// const transactionRes = await executeContractFunction(survivorContract, "upgrade_stat", [[adventurerId, 0], statToUpgrade]);
	}
	
	if (events[EVENTS.DISCOVERY]) {
		discoveryType = discovery[Number(events[EVENTS.DISCOVERY][DISCOVERY_TYPE_INDEX])];

		console.log(FgYellow + `Discovered ${discoveryType}` + reset);

		if (discoveryType == DISCOVERY_TYPES.BEAST) {
			const entityId = Number(events[EVENTS.DISCOVERY][ENTITY_ID_INDEX]);
		
			console.log(events[EVENTS.CREATE_BEAST]);
		
			console.log(FgYellow + `What should the adventurer do? 1 : attack 2: flee` + reset);

			const res = await executeContractFunction(beastsContract, "flee", [[entityId, 0]]);
			break;
		}
	}

	await waitUserIntervention(FgRed + "Transaction was " + discoveryType + ", waiting for human intervention" + reset);
}
