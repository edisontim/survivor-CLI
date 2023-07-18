import { Account, ec, Provider, Contract, json} from "starknet";
import * as fs from "fs";
import * as readline from "readline";
import path from 'path';
import { fileURLToPath } from 'url';
import * as BN from 'bn.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const NETWORK = "goerli-alpha";
const NON_EVENT = undefined;

const reset = "\x1b[0m";
const FgBlack = "\x1b[30m";
const FgRed = "\x1b[31m"
const FgGreen = "\x1b[32m"
const FgMagenta = "\x1b[35m"
const FgYellow = "\x1b[33m"

export default class Game {

	async executeContractFunction(contract, funcName, params) {
		let transactionResult = false;
		try {
			let invokeRes = await contract.contract.invoke(funcName, params);
			transactionResult = await contract.provider.waitForTransaction(invokeRes.transaction_hash);
			console.log(`Transaction hash: ${invokeRes.transaction_hash}`);
			
			while (transactionResult.status !== "ACCEPTED_ON_L2") {
				transactionResult = await contract.provider.waitForTransaction(invokeRes.transaction_hash);
			}
	
			console.log(FgGreen + `Successful transaction: ${funcName}` + reset);
	
		} catch (err) {
			console.log(err);
			console.log(FgRed + "%s" + reset, 'Failed transaction: ' + funcName);
			await new Promise(resolve => setTimeout(resolve, 100000));
		}
	
		return transactionResult;
	}

	async getAdventurerHealth(advId) {
		return ((await this.gameCtx.CONTRACTS.survivor.contract.call("get_adventurer_by_id", [[advId, 0]])).adventurer.Health.toNumber());
	}

	async getAdventurerById(advId) {
		return (await this.gameCtx.CONTRACTS.survivor.contract.call("get_adventurer_by_id", [[advId, 0]]));
	}

	async getBeastById(beastId) {
		const res = await this.gameCtx.CONTRACTS.beasts.contract.call("get_beast_by_id", [[beastId, 0]]);
		return (res);
	}
	
	formatBeast(beast) {
		let map = {};
		if (beast.Id.toNumber() === 0) {
			return ("Adventurer isn't fighting any beasts");
		}
		const beastName = this.gameData.BEASTS[beast.Id.toNumber()];
		map["name"] = this.gameData.ITEM_NAME_PREFIXES[beast.Prefix_1.toNumber()] + this.gameData.ITEM_NAME_SUFFIXES[beast.Prefix_2.toNumber()] + beastName;
		map["attackType"] = this.gameData.ITEM_TYPES[beast.AttackType.toNumber()];
		map["attackLocation"] = this.gameData.BEAST_ATTACK_LOCATION[beastName];
		map["armorType"] = this.gameData.ITEM_TYPES[beast.ArmorType.toNumber()];
		map["rank"] = beast.Rank.toNumber();
		map["health"] = beast.Health.toNumber();
		map["level"] = beast.Level.toNumber();
	
		return (map);
	}
	
	async showBeast(advId) {
		const beastId = (await this.getAdventurerById(advId)).adventurer.Beast.toNumber();
		let beast = (await this.getBeastById(beastId)).beast;
	
		console.log(this.formatBeast(beast));
	
		return (NON_EVENT);
	}
	
	async showStats(advId) {
		const adventurer = (await this.getAdventurerById(advId)).adventurer;
		let stats = {};
		stats["health"] = adventurer.Health.toNumber();
		stats["level"] = adventurer.Level.toNumber();
		stats["strength"] = adventurer.Strength.toNumber();
		stats["dexterity"] = adventurer.Dexterity.toNumber();
		stats["vitality"] = adventurer.Vitality.toNumber();
		stats["intelligence"] = adventurer.Intelligence.toNumber();
		stats["wisdom"] = adventurer.Wisdom.toNumber();
		stats["charisma"] = adventurer.Charisma.toNumber();
		stats["luck"] = adventurer.Luck.toNumber();
		stats["xp"] = adventurer.XP.toNumber();
	
		console.log(stats);
		return (NON_EVENT);
	}

	async mintWithStartingWeapon() {
		let newAdvId = 0;
		console.log("You didn't provide an adventurer ID, let's mint one together");
		let query = FgMagenta + `Choose race\n` + reset + `${[...Object.values(this.gameData.RACES)].join(", ")}\n`;
		let race = await this.prompt.waitUserIntervention(query);
		while (!(race in this.gameData.INVERTED_RACES)) {
			race = await this.prompt.waitUserIntervention(query); 
		}
		race = this.gameData.INVERTED_RACES[race];

		query = FgMagenta + `Choose name\n` + reset;
		let name = await this.prompt.waitUserIntervention(query);
		
		query = `Choose order ${[...Object.values(this.gameData.ORDERS)].join(", ")}\n`;
		let order = await this.prompt.waitUserIntervention(query);
		while (!(order in this.gameData.INVERTED_ORDERS)) {
			order = await this.prompt.waitUserIntervention(query); 
		}

		order = this.gameData.INVERTED_ORDERS[order];

		const usrAccAddr = new BN.BN(this.userAccAddr.slice(2), "hex");
		race = new BN.BN(race);
		const homeRealm = new BN.BN(1)
		let utf8Encode = new TextEncoder();
		const encodedName = utf8Encode.encode(name);
		name = Array.from(encodedName);
		name = new BN.BN(name);
		order = new BN.BN(order);
		const imgHash1 = new BN.BN(1);
		const imgHash2 = new BN.BN(1);
		const weaponId = new BN.BN(46);
		let interfaceAddress = "0x7642a1c8d575b0c0f9a7ad7cceb5517c02f36e5f3b36b25429cc7c99383ed0a";
		interfaceAddress = new BN.BN(interfaceAddress.slice(2), "hex");
		const params = [usrAccAddr, race, homeRealm, name, order, imgHash1, imgHash2, weaponId, interfaceAddress];

		let promises = [];
		promises.push(this.gameCtx.CONTRACTS.erc20.invoke("mint", [usrAccAddr, ["100000000000000000000", 0]]));
		promises.push(this.gameCtx.CONTRACTS.erc20.invoke("approve", [usrAccAddr, ["100000000000000000000", 0]]));
		promises.push(this.gameCtx.CONTRACTS.survivor.invoke("mint_with_starting_weapon", params));
		const [mint, approve, mint_with_starting_weapon] = await Promise.all(promises);
		console.log(mint);
		console.log(approve);

		let events = {};
		
		for (let e of mintWithStartingWeapon.events) {
			events[e.keys[0]] = e.data;
		}

		if (events[this.gameData.EVENTS.MINT_WITH_STARTING_WEAPON]) {
			console.log("Success!");
			console.log(events[this.gameData.EVENTS.MINT_WITH_STARTING_WEAPON]);
		}

		return (newAdvId);
	}

	async showStuff(advId) {
		const res = await this.gameCtx.CONTRACTS.survivor.call("owner_of", [[advId, 0]]);
		console.log(res);
		// const adventurer = (await this.getAdventurerById(advId)).adventurer;
	
		// const items = ["WeaponId", "ChestId", "HeadId", "WaistId", "FeetId", "HandsId", "NeckId", "RingId"];
		// const promises = items.map(item => {
	
		// });
		let map = {};
		// console.log(adventurer);
		return (NON_EVENT);
	}
	

	async upgradeStat(adventurerId) {
		await this.showStats(adventurerId);
		const query = FgYellow + `Choose stat: ${[...Object.values(this.gameData.STATS)].join(", ")}` + reset + "\n";
		let statToUpgrade = await this.prompt.waitUserIntervention(query); 
		while (!(statToUpgrade in this.gameData.INVERTED_STATS)) {
			statToUpgrade = await this.prompt.waitUserIntervention(query); 
		}
		statToUpgrade = this.gameData.INVERTED_STATS[statToUpgrade];
		const transactionRes = await this.executeContractFunction(this.gameCtx.CONTRACTS.survivor, "upgrade_stat", [[adventurerId, 0], statToUpgrade]);
		return (transactionRes);
	}

	async explore(adventurerId) {
		let exploreRes = await this.executeContractFunction(this.gameCtx.CONTRACTS.survivor, "explore", [[adventurerId, 0]]);

		let discoveryType;

		// Reformat the transaction events
		let events = {};
		for (let e of exploreRes.events) {
			events[e.keys[0]] = e.data;
		}

		discoveryType = this.gameData.DISCOVERY_TYPES[Number(events[this.gameData.EVENTS.DISCOVERY][this.gameData.DISCOVERY_TYPE_INDEX])];
		console.log(FgYellow + `Discovered ${discoveryType}` + reset);
		
		if (discoveryType === "Item") {
			const itemDiscoveryType = this.gameData.ITEM_DISCOVERY_TYPES[Number(events[this.gameData.EVENTS.DISCOVERY][this.gameData.DISCOVERY_SUB_TYPE_INDEX])];
			console.log(FgYellow + `Item type: ${itemDiscoveryType}` + reset);
		}

		if (events[this.gameData.EVENTS.CREATE_BEAST]) {
			await this.showBeast(adventurerId);
		}

		if (events[this.gameData.EVENTS.LEVEL_UP]) {
			const levelReached = Number(events[this.gameData.EVENTS.LEVEL_UP][this.gameData.LEVEL_UP_INDEX]);
			console.log(FgGreen + `Leveled up to lvl ${levelReached} !` + reset);
		}
		
		if (events[this.gameData.EVENTS.MINT_ITEM]) {
			console.log(events[this.gameData.EVENTS.MINT_ITEM]);
		}

		return (exploreRes);
	}

	async flee(adventurerId) {
		const beastId = (await this.getAdventurerById(adventurerId)).adventurer.Beast.toNumber();
		return (await this.executeContractFunction(this.gameCtx.CONTRACTS.beasts, "flee", [[beastId, 0]]));
	}

	async attack(adventurerId) {
		const beastId = (await this.getAdventurerById(adventurerId)).adventurer.Beast.toNumber();
		const ret = await this.executeContractFunction(this.gameCtx.CONTRACTS.beasts, "attack", [[beastId, 0]]);
		const bindedFunc = this.showBeast.bind(this);
		await bindedFunc(beastId);
		return (ret);
	}

	async doNextAction(action, advId) {
		const bindedFunc = this.ACTIONS[action].bind(this);
		return await (bindedFunc(advId));
	}

	async start() {
		if (Number.isNaN(this.adventurerId)) {
			let mintRes = await this.mintWithStartingWeapon();
		}
		let prevHealth = await this.getAdventurerHealth(this.adventurerId);
		console.log(`Adventurer's current health: ${prevHealth}`);

		while (true) {
			const action = await this.prompt.getNextAction(this.ACTIONS);
			const transactionRes = await this.doNextAction(action, this.adventurerId);

			let currentHealth = await this.getAdventurerHealth(this.adventurerId);
			if (currentHealth < prevHealth) {
				prevHealth = currentHealth;
				console.log(FgRed + "adventurer lost some health! Down to " + prevHealth + reset);
			}
		}
	}

	constructor(adventurerId,  userAccAddr, userPrivKey) {
		this.adventurerId = adventurerId;
		this.userAccAddr = userAccAddr;
		this.gameCtx = new GameCtx(NETWORK, userAccAddr, userPrivKey);
		this.gameData = new GameData();
		this.prompt = new Prompt();
		this.ACTIONS = {
			"attack": this.attack,
			"flee": this.flee,
			"upgrade_stat": this.upgradeStat,
			"explore": this.explore,
			"show_beast": this.showBeast,
			"show_stats": this.showStats,
			"show_stuff": this.showStuff,
			// "show_equipment": showEquipment,
		}
	}
  
}

class Prompt {
	waitUserIntervention(query) {
		return new Promise(resolve => this.rl.question(query, ans => {
			resolve(ans);
		}))
	}

	async getNextAction(actionsPossible) {
		const query = FgMagenta + "What is going to be your next action?\n" + reset + [...Object.keys(actionsPossible)].join(", ") + "\n";
		let response = await this.waitUserIntervention(query);
		while (!(response in actionsPossible)) {
			response = await this.waitUserIntervention(query);
		}
		return (response);
	}

	constructor(actions) {
		this.rl = readline.createInterface({
			input: process.stdin,  // Read input from the command line
			output: process.stdout // Output text to the command line
		});
	}
}

class GameContract {
	async call(funcName, params) {
		return (await this.contract.call(funcName, params));
	}


	async invoke(funcName, params) {
		return (await this.contract.invoke(funcName, params));
	}

	constructor(abiFileName, contractAddr, account, provider) {
		const abi = json.parse(fs.readFileSync(path.resolve(__dirname, "../contracts/" + abiFileName)).toString("ascii"));
		if (abi === undefined) { 
			throw new Error(`No abi found for ${abiFileName}`) 
		};
		this.contract = new Contract(abi, contractAddr, provider);
		this.contract.connect(account);
		
		this.provider = provider;

	}
}

class GameCtx {
	constructor(network, userAccAddr, userPrivKey) {
		this.provider = new Provider({ sequencer: { network: network}});

		this.account = new Account(this.provider, userAccAddr, ec.getKeyPair(userPrivKey));

		this.CONTRACTS_ADDR = {
			SURVIVOR_CONTRACT_ADDR: "0x059daa60c4fbbb2866bbaf55b32916bd55d39243a2f97d78938fdfba79f1a4f2",
			BEASTS_CONTRACT_ADDR: "0x00d4941e7c42c06437cff11b2f50933d38b19ffd6c9a317bbddcc836ca83f113",
			LOOT_CONTRACT_ADDR: "0x051f4d360d69a19ff9cc00ebf733d0485e52e2880f0e1e506b041a4770418181",
			ERC20_CONTRACT_ADDR: "0x059dac5df32cbce17b081399e97d90be5fba726f97f00638f838613d088e5a47",
		}

		this.CONTRACTS = {
			survivor: new GameContract("survivor.json", this.CONTRACTS_ADDR.SURVIVOR_CONTRACT_ADDR, this.account, this.provider),
			beasts: new GameContract("beasts.json", this.CONTRACTS_ADDR.BEASTS_CONTRACT_ADDR, this.account, this.provider),
			loot: new GameContract("loot.json", this.CONTRACTS_ADDR.LOOT_CONTRACT_ADDR, this.account, this.provider),
			erc20: new GameContract("ERC20.json", this.CONTRACTS_ADDR.ERC20_CONTRACT_ADDR, this.account, this.provider),
		}
	}
}

class GameData {
	constructor() {
		this.EVENTS = {
			DISCOVERY: "0x32cbdf518aa1395df2b69a6a00662a683a8de526eda2c7ea88145ddfa53e4ed",
			LEVEL_UP: "0x16b747f083a5bc0eb62f1465891cc9b6ce061c09e77556f949348af4e7a608a",
			CREATE_BEAST: "0x3c1d06985ef07b174e37f912d604fbfd3e60d6b519abf5a9e95bed3090961c",
			MINT_ITEM: "0x051f4d360d69a19ff9cc00ebf733d0485e52e2880f0e1e506b041a4770418181",
			UPDATE_ITEM_STATE: "0x051f4d360d69a19ff9cc00ebf733d0485e52e2880f0e1e506b041a4770418181",
			MINT_WITH_STARTING_WEAPON: "0x31cf892296d52008383422948f58c5545ebbe6ee0612a183edb78aad6538e06",
		}

		this.DISCOVERY_TYPE_INDEX = 2;
		this.DISCOVERY_SUB_TYPE_INDEX = 3;
		this.LEVEL_UP_INDEX = 2;

		this.BEASTS = {
			1: "Pheonix",
			2: "Griffin",
			3: "Minotaur",
			4: "Basilisk",
			5: "Gnome",
			6: "Wraith",
			7: "Ghoul",
			8: "Goblin",
			9: "Skeleton",
			10: "Golem",
			11: "Giant",
			12: "Yeti",
			13: "Orc",
			14: "Beserker",
			15: "Ogre",
			16: "Dragon",
			17: "Vampire",
			18: "Werewolf",
			19: "Spider",
			20: "Rat",
		};

		this.ITEMS = {
			1: "Pendant",
			2: "Necklace",
			3: "Amulet",
			4: "Silver Ring",
			5: "Bronze Ring",
			6: "Platinum Ring",
			7: "Titanium Ring",
			8: "Gold Ring",
			9: "Ghost Wand",
			10: "Grave Wand",
			11: "Bone Wand",
			12: "Wand",
			13: "Grimoire",
			14: "Chronicle",
			15: "Tome",
			16: "Book",
			17: "Divine Robe",
			18: "Silk Robe",
			19: "Linen Robe",
			20: "Robe",
			21: "Shirt",
			22: "Crown",
			23: "Divine Hood",
			24: "Silk Hood",
			25: "Linen Hood",
			26: "Hood",
			27: "Brightsilk Sash",
			28: "Silk Sash",
			29: "Wool Sash",
			30: "Linen Sash",
			31: "Sash",
			32: "Divine Slippers",
			33: "Silk Slippers",
			34: "Wool Shoes",
			35: "Linen Shoes",
			36: "Shoes",
			37: "Divine Gloves",
			38: "Silk Gloves",
			39: "Wool Gloves",
			40: "Linen Gloves",
			41: "Gloves",
			42: "Katana",
			43: "Falchion",
			44: "Scimitar",
			45: "Long Sword",
			46: "Short Sword",
			47: "Demon Husk",
			48: "Dragonskin Armor",
			49: "Studded Leather Armor",
			50: "Hard Leather Armor",
			51: "Leather Armor",
			52: "Demon Crown",
			53: "Dragons Crown",
			54: "War Cap",
			55: "Leather Cap",
			56: "Cap",
			57: "Demonhide Belt",
			58: "Dragonskin Belt",
			59: "Studded Leather Belt",
			60: "Hard Leather Belt",
			61: "Leather Belt",
			62: "Demonhide Boots",
			63: "Dragonskin Boots",
			64: "Studded Leather Boots",
			65: "Hard Leather Boots",
			66: "Leather Boots",
			67: "Demons Hands",
			68: "Dragonskin Gloves",
			69: "Studded Leather Gloves",
			70: "Hard Leather Gloves",
			71: "Leather Gloves",
			72: "Warhammer",
			73: "Quarterstaff",
			74: "Maul",
			75: "Mace",
			76: "Club",
			77: "Holy Chestplate",
			78: "Ornate Chestplate",
			79: "Plate Mail",
			80: "Chain Mail",
			81: "Ring Mail",
			82: "Ancient Helm",
			83: "Ornate Helm",
			84: "Great Helm",
			85: "Full Helm",
			86: "Helm",
			87: "Ornate Belt",
			88: "War Belt",
			89: "Plated Belt",
			90: "Mesh Belt",
			91: "Heavy Belt",
			92: "Holy Greaves",
			93: "Ornate Greaves",
			94: "Greaves",
			95: "Chain Boots",
			96: "Heavy Boots",
			97: "Holy Gauntlets",
			98: "Ornate Gauntlets",
			99: "Gauntlets",
			100: "Chain Gloves",
			101: "Heavy Gloves",
		};

		this.RACES = {
			1: "Elf",
			2: "Fox",
			3: "Giant",
			4: "Human",
			5: "Orc",
			6: "Demon",
			7: "Goblin",
			8: "Fish",
			9: "Cat",
			10: "Frog",
		};

		this.INVERTED_RACES = {};
		for (const key in this.RACES) {
			this.INVERTED_RACES[this.RACES[key]] = key;
		}

		this.ORDERS = {
			1: "Power",
			2: "Giants",
			3: "Titans",
			4: "Skill",
			5: "Perfection",
			6: "Brilliance",
			7: "Enlightenment",
			8: "Protection",
			9: "Twins",
			10: "Reflection",
			11: "Detection",
			12: "Fox",
			13: "Vitriol",
			14: "Fury",
			15: "Rage",
			16: "Anger",
		};
		
		this.INVERTED_ORDERS = {};
		for (const key in this.ORDERS) {
			this.INVERTED_ORDERS[this.ORDERS[key]] = key;
		}

		this.STATS = {
			2: "Strength",
			3: "Dexterity",
			4: "Vitality",
			5: "Intelligence",
			6: "Wisdom",
			7: "Charisma",
			8: "Luck",
		};

		this.INVERTED_STATS = {};
		for (const key in this.STATS) {
			this.INVERTED_STATS[this.STATS[key]] = key;
		}

		this.OBSTACLES = {
			1: "Demonic Alter",
			2: "Curse",
			3: "Hex",
			4: "Magic Lock",
			5: "Dark Mist",
			6: "Collapsing Ceiling",
			7: "Crushing Walls",
			8: "Rockslide",
			9: "Tumbling Boulders",
			10: "Swinging Logs",
			11: "Pendulum Blades",
			12: "Flame Jet",
			13: "Poision Dart",
			14: "Spiked Pit",
			15: "Hidden Arrow",
		};

		this.DISCOVERY_TYPES = {
			0: "Nothing",
			1: "Beast",
			2: "Obstacle",
			3: "Item",
			4: "Adventurer",
		};

		this.ITEM_DISCOVERY_TYPES = {
			0: "Gold",
			1: "Loot",
			2: "Health",
		};

		this.ITEM_TYPES = {
			0: "Generic",
			100: "Generic Weapon",
			101: "Bludgeon Weapon",
			102: "Blade Weapon",
			103: "Magic Weapon",
			200: "Generic Armor",
			201: "Metal Armor",
			202: "Hide Armor",
			203: "Cloth Armor",
			300: "Ring Jewelry",
			400: "Necklace Jewelry",
		};

		this.MATERIALS = {
			0: "Generic",
			1000: "Generic Metal",
			1001: "Ancient Metal",
			1002: "Holy Metal",
			1003: "Ornate Metal",
			1004: "Gold Metal",
			1005: "Silver Metal",
			1006: "Bronze Metal",
			1007: "Platinum Metal",
			1008: "Titanium Metal",
			1009: "Steel Metal",
			2000: "Generic Cloth",
			2001: "Royal Cloth",
			2002: "Divine Cloth",
			2003: "Brightsilk Cloth",
			2004: "Silk Cloth",
			2005: "Wool Cloth",
			2006: "Linen Cloth",
			3000: "Generic Biotic",
			3100: "Demon Generic Biotic",
			3101: "Demon Blood Biotic",
			3102: "Demon Bones Biotic",
			3103: "Demon Brain Biotic",
			3104: "Demon Eyes Biotic",
			3105: "Demon Hide Biotic",
			3106: "Demon Flesh Biotic",
			3107: "Demon Hair Biotic",
			3108: "Demon Heart Biotic",
			3109: "Demon Entrails Biotic",
			3110: "Demon Hands Biotic",
			3111: "Demon Feet Biotic",
			3200: "Dragon Generic Biotic",
			3201: "Dragon Blood Biotic",
			3202: "Dragon Bones Biotic",
			3203: "Dragon Brain Biotic",
			3204: "Dragon Eyes Biotic",
			3205: "Dragon Skin Biotic",
			3206: "Dragon Flesh Biotic",
			3207: "Dragon Hair Biotic",
			3208: "Dragon Heart Biotic",
			3209: "Dragon Entrails Biotic",
			3210: "Dragon Hands Biotic",
			3211: "Dragon Feet Biotic",
			3300: "Animal Generic Biotic",
			3301: "Animal Blood Biotic",
			3302: "Animal Bones Biotic",
			3303: "Animal Brain Biotic",
			3304: "Animal Eyes Biotic",
			3305: "Animal Hide Biotic",
			3306: "Animal Flesh Biotic",
			3307: "Animal Hair Biotic",
			3308: "Animal Heart Biotic",
			3309: "Animal Entrails Biotic",
			3310: "Animal Hands Biotic",
			3311: "Animal Feet Biotic",
			3400: "Human Generic Biotic",
			3401: "Human Blood Biotic",
			3402: "Human Bones Biotic",
			3403: "Human Brain Biotic",
			3404: "Human Eyes Biotic",
			3405: "Human Hide Biotic",
			3406: "Human Flesh Biotic",
			3407: "Human Hair Biotic",
			3408: "Human Heart Biotic",
			3409: "Human Entrails Biotic",
			3410: "Human Hands Biotic",
			3411: "Human Feet Biotic",
			4000: "Generic Paper",
			4001: "Magical Paper",
			5000: "Generic Wood",
			5100: "Generic Hardwood",
			5101: "Walnut Hardwood",
			5102: "Mahogany Hardwood",
			5103: "Maple Hardwood",
			5104: "Oak Hardwood",
			5105: "Rosewood Hardwood",
			5106: "Cherry Hardwood",
			5107: "Balsa Hardwood",
			5108: "Birch Hardwood",
			5109: "Holly Hardwood",
			5200: "Generic Softwood",
			5201: "Cedar Softwood",
			5202: "Pine Softwood",
			5203: "Fir Softwood",
			5204: "Hemlock Softwood",
			5205: "Spruce Softwood",
			5206: "Elder Softwood",
			5207: "Yew Softwood",
		};

		this.ITEM_NAME_PREFIXES = {
			1: "Agony ",
			2: "Apocalypse ",
			3: "Armageddon ",
			4: "Beast ",
			5: "Behemoth ",
			6: "Blight ",
			7: "Blood ",
			8: "Bramble ",
			9: "Brimstone ",
			10: "Brood ",
			11: "Carrion ",
			12: "Cataclysm ",
			13: "Chimeric ",
			14: "Corpse ",
			15: "Corruption ",
			16: "Damnation ",
			17: "Death ",
			18: "Demon ",
			19: "Dire ",
			20: "Dragon ",
			21: "Dread ",
			22: "Doom ",
			23: "Dusk ",
			24: "Eagle ",
			25: "Empyrean ",
			26: "Fate ",
			27: "Foe ",
			28: "Gale ",
			29: "Ghoul ",
			30: "Gloom ",
			31: "Glyph ",
			32: "Golem ",
			33: "Grim ",
			34: "Hate ",
			35: "Havoc ",
			36: "Honour ",
			37: "Horror ",
			38: "Hypnotic ",
			39: "Kraken ",
			40: "Loath ",
			41: "Maelstrom ",
			42: "Mind ",
			43: "Miracle ",
			44: "Morbid ",
			45: "Oblivion ",
			46: "Onslaught ",
			47: "Pain ",
			48: "Pandemonium ",
			49: "Phoenix ",
			50: "Plague ",
			51: "Rage ",
			52: "Rapture ",
			53: "Rune ",
			54: "Skull ",
			55: "Sol ",
			56: "Soul ",
			57: "Sorrow ",
			58: "Spirit ",
			59: "Storm ",
			60: "Tempest ",
			61: "Torment ",
			62: "Vengeance ",
			63: "Victory ",
			64: "Viper ",
			65: "Vortex ",
			66: "Woe ",
			67: "Wrath ",
			68: "Lights ",
			69: "Shimmering ",
		};

		this.ITEM_NAME_SUFFIXES = {
			1: "Bane ",
			2: "Root ",
			3: "Bite ",
			4: "Song ",
			5: "Roar ",
			6: "Grasp ",
			7: "Instrument ",
			8: "Glow ",
			9: "Bender ",
			10: "Shadow ",
			11: "Whisper ",
			12: "Shout ",
			13: "Growl ",
			14: "Tear ",
			15: "Peak ",
			16: "Form ",
			17: "Sun ",
			18: "Moon ",
		};

		this.ITEM_SUFFIXES = {
			1: "Of Power",
			2: "Of Giant",
			3: "Of Titans",
			4: "Of Skill",
			5: "Of Perfection",
			6: "Of Brilliance",
			7: "Of Enlightenment",
			8: "Of Protection",
			9: "Of Anger",
			10: "Of Rage",
			11: "Of Fury",
			12: "Of Vitriol",
			13: "Of The Fox",
			14: "Of Detection",
			15: "Of Reflection",
			16: "Of The Twins",
		};

		this.STATUS = { 0: "Closed", 1: "Open" };

		this.ADVENTURER_STATUS = {0: "Iddle", 1: "Busy"};

		this.SLOTS = {
			1: "Weapon",
			2: "Chest",
			3: "Head",
			4: "Waist",
			5: "Foot",
			6: "Hand",
			7: "Neck",
			8: "Ring",
		};

		this.BEAST_ATTACK_LOCATION = {
			Phoenix: "head",
			Griffin: "chest",
			Minotaur: "hand",
			Basilisk: "waist",
			Gnome: "foot",
			Wraith: "chest",
			Ghoul: "hand",
			Goblin: "waist",
			Skeleton: "foot",
			Golem: "head",
			Giant: "hand",
			Yeti: "waist",
			Orc: "foot",
			Berserker: "head",
			Ogre: "chest",
			Dragon: "waist",
			Vampire: "foot",
			Werewolf: "head",
			Spider: "chest",
			Rat: "hand",
		};
	}
}