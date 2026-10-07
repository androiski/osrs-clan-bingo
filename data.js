// Teams, tiles, rules and the TempleOSRS item/hiscore lists behind each tile.
// Shared by the site and the update job (update.js).

export const TEAMS = [
  {id:"tt", name:"Thompy Thiccs", icon:13071, members:["yaint thiccy","Cenaras","BIS Ben","chmsst","Wildhero","47demonsand","piinktaco","The Biplane","ll Grub ll"]},
  {id:"dd", name:"The Desert Dogs", icon:34459, members:["duhmass","ndru","Mspartam","789","Sparge","Roof Sniffa","Exviped","Bhnr","Halfmeatball","nafun"]},
  {id:"bk", name:"The Bakery", icon:1891, members:["tv milk","rpwh","Im Lablabi","nimbis","Gpmorgnchase","spotttt","Dead Naseeph","LootBuster42","PlE"]}
];

export const SOURCES = {
  clog:   {mark:"Log", label:"Collection log", detail:"Read from TempleOSRS. First-time drops show up on their own with Automatically sync Collection Log on. For a repeat drop, open that collection log page again."},
  qty:    {mark:"Log ×", label:"Collection log count", detail:"Counted from how much the team's collection log counts have gone up since the start. First-time drops show up on their own; for a repeat drop, open the item's collection log page again."},
  xp:     {mark:"XP", label:"Hiscores XP", detail:"Team total gained during the event, from TempleOSRS hiscores. Players must be updated on Temple before the start (Auto-Update does this when you log out)."}
};

// n: full tile name; short: shorter name used on phones, where tiles are small.
export const TILES = [
  {n:"Ring of Endurance", s:"clog"},
  {n:"1 Enhanced or 3 Armor Seeds", short:"Crystal Seeds", s:"qty", target:3, count:"Armour seeds", alone:["Enhanced crystal weapon seed"], rule:"Seeds can come from different players on the team."},
  {n:"Dragonhunter Wand", s:"clog"},
  {n:"Any Pet", s:"clog", rule:"Every pet counts, including skilling pets and the chompy chick."},
  {n:"Any ToA Purple (no LB/Fang)", short:"ToA Purple", s:"clog"},
  {n:"3 Venator Shards", s:"qty", target:3, count:"Shards", rule:"Shards can come from different players on the team."},
  {n:"Any Maggot King Unique", short:"Maggot King Unique", s:"clog"},
  {n:"Any Virtus Piece", short:"Virtus Piece", s:"clog"},
  {n:"Inky Paint", s:"clog"},
  {n:"Any Voidwaker Piece", short:"Voidwaker Piece", s:"clog"},
  {n:"Any ToB Purple (no Avernic)", short:"ToB Purple", s:"clog"},
  {n:"Araxxor Fang or 3 Hally Pieces", short:"Fang / 3 Hally", s:"qty", target:3, count:"Hally pieces", alone:["Araxyte fang"], countIcon:29796 /* Noxious halberd */, rule:"Pieces can come from different players on the team."},
  {n:"500,000 Runecraft XP", short:"500k RC XP", s:"xp", target:500000},
  {n:"1 Full Barrows Set", short:"Barrows Set", s:"qty", target:4, rule:"All 4 pieces of one brother's set. Pieces can come from different players on the team."},
  {n:"Pharaoh's Sceptre", s:"clog"},
  {n:"1 Tanz Fang", short:"Tanz Fang", s:"clog"},
  {n:"Golden Tench", s:"clog"},
  {n:"Dragon Limbs", s:"clog"},
  {n:"Any PNM Unique", short:"PNM Unique", s:"clog"},
  {n:"Horn or Oathplate Piece", short:"Horn / Oathplate", s:"clog"},
  {n:"Crystal Tool Seed", s:"clog"},
  {n:"Any Doom Unique (no pet)", short:"Doom Unique", s:"clog"},
  {n:"Any CoX Purple (no prayer scroll)", short:"CoX Purple", s:"clog"},
  {n:"A Zenyte", short:"Zenyte", s:"clog"},
  {n:"Any Cerb Crystal", short:"Cerb Crystal", s:"clog"}
];

// The collection log section each tile is tracked from (shown in the tile panel).
export const CLOG_SECTION = {0:"Hallowed Sepulchre",1:"The Gauntlet",2:"Hueycoatl",3:"All Pets",4:"Tombs of Amascut",
  5:"Phantom Muspah",6:"Maggot King",7:"Desert Treasure II bosses",8:"Boat Paints",9:"Wilderness bosses",
  10:"Theatre of Blood",11:"Araxxor",12:"Runecraft",13:"Barrows Chests",14:"Miscellaneous",15:"Zulrah",
  16:"Aerial Fishing",17:"Miscellaneous",18:"The Nightmare",19:"Yama",20:"Zalcano",21:"Doom of Mokhaiotl",
  22:"Chambers of Xeric",23:"Glough's Experiments",24:"Cerberus"};

// The icon shown on each board tile, by clog item name (looked up in TILE_ITEMS).
export const TILE_ICON = {0:"Ring of endurance",1:"Enhanced crystal weapon seed",2:"Dragon hunter wand",3:34485 /* Shiba (adult, tan): a pet that doesn't count */,
  4:"Tumeken's shadow",5:"Venator shard",6:"Elder venator fang",7:"Virtus mask",8:"Inky paint",9:"Voidwaker hilt",
  10:"Scythe of Vitur",11:"Araxyte fang",13:"Dharok's helm",14:"Pharaoh's sceptre",15:"Tanzanite fang",
  16:"Golden tench",17:"Dragon limbs",18:"Inquisitor's great helm",19:"Soulflame horn",20:"Crystal tool seed",
  21:"Eye of Ayak",22:"Twisted bow",23:"Zenyte shard",24:"Primordial crystal"};

// What to chart under the board for each tile: TempleOSRS hiscore fields summed
// across the team. Tiles left out have no hiscore, so they can't be tracked.
export const TRACK = {
  14:{unit:"XP", acts:["Thieving"], proxy:"Includes all Thieving, since Pyramid Plunder isn't on the hiscores."},
  16:{unit:"XP", acts:["Fishing"], proxy:"Includes all Fishing, since aerial fishing isn't on the hiscores."},
  0:{unit:"XP", acts:["Agility"], proxy:"Includes all Agility, since the Sepulchre isn't on the hiscores."},
  1:{unit:"KC", acts:["The Gauntlet","The Corrupted Gauntlet"], short:"Gauntlet"},
  2:{unit:"KC", acts:["Hueycoatl"]},
  4:{unit:"KC", acts:["Tombs of Amascut","Tombs of Amascut Expert"], short:"ToA"},
  5:{unit:"KC", acts:["Phantom Muspah"]},
  6:{unit:"KC", acts:["Maggot King"]},
  7:{unit:"KC", acts:["Duke Sucellus","The Leviathan","Vardorvis","The Whisperer"], short:"DT2 bosses", label:"Total KC from the Desert Treasure II bosses (Duke Sucellus, The Leviathan, Vardorvis, The Whisperer)"},
  9:{unit:"KC", acts:["Callisto","Artio","Venenatis","Spindel","Vetion","Calvarion"], short:"Wildy bosses", label:"Total KC from the wilderness bosses (Callisto, Artio, Venenatis, Spindel, Vet'ion, Calvarion)"},
  10:{unit:"KC", acts:["Theatre of Blood","Theatre of Blood Challenge Mode"], short:"ToB"},
  11:{unit:"KC", acts:["Araxxor"]},
  12:{unit:"XP", acts:["Runecraft"], icon:"https://cdn.jsdelivr.net/gh/runelite/runelite@runelite-parent-1.13.1/runelite-client/src/main/resources/skill_icons/runecraft.png"},
  13:{unit:"KC", acts:["Barrows Chests"]},
  15:{unit:"KC", acts:["Zulrah"]},
  18:{unit:"KC", acts:["Phosanis Nightmare"]},
  19:{unit:"KC", acts:["Yama"]},
  20:{unit:"KC", acts:["Zalcano"]},
  21:{unit:"KC", acts:["Doom of Mokhaiotl"]},
  22:{unit:"KC", acts:["Chambers of Xeric","Chambers of Xeric Challenge Mode"], short:"CoX"},
  24:{unit:"KC", acts:["Cerberus"]}
};
export const ACT_NAMES = {"Tombs of Amascut":"ToA","Theatre of Blood":"ToB","Chambers of Xeric":"CoX","Agility":"Agility XP","Thieving":"Thieving XP","Fishing":"Fishing XP","Runecraft":"Runecraft XP","The Corrupted Gauntlet":"Corrupted Gauntlet","Tombs of Amascut Expert":"ToA Expert",
  "Theatre of Blood Challenge Mode":"ToB Hard Mode","Chambers of Xeric Challenge Mode":"CoX CM",
  "Phosanis Nightmare":"Phosani's Nightmare","Vetion":"Vet'ion"};

// Icon for each tracked boss (its pet, by item ID; Barrows has no pet so it uses a
// Barrows helm) or skill (RuneLite's skill icon). Used on the player cards.
export const SKILL_ICON = s => `https://cdn.jsdelivr.net/gh/runelite/runelite@runelite-parent-1.13.1/runelite-client/src/main/resources/skill_icons_small/${s}.png`;
export const ACT_ICON = {"Zulrah":12921,"The Gauntlet":23757,"The Corrupted Gauntlet":23757,"Hueycoatl":30152,
  "Tombs of Amascut":27352,"Tombs of Amascut Expert":27352,"Phantom Muspah":27590,"Maggot King":33642,
  "Duke Sucellus":28250,"The Leviathan":28252,"Vardorvis":28248,"The Whisperer":28246,
  "Callisto":13178,"Artio":13178,"Venenatis":13177,"Spindel":13177,"Vetion":13179,"Calvarion":13179,
  "Theatre of Blood":22473,"Theatre of Blood Challenge Mode":22473,"Araxxor":29836,"Phosanis Nightmare":24491,
  "Yama":30888,"Zalcano":23760,"Doom of Mokhaiotl":31130,"Chambers of Xeric":20851,
  "Chambers of Xeric Challenge Mode":20851,"Cerberus":13247,"Barrows Chests":4716,
  "Agility":SKILL_ICON("agility"),"Thieving":SKILL_ICON("thieving"),"Fishing":SKILL_ICON("fishing"),"Runecraft":SKILL_ICON("runecraft")};

// Drop rates for the Luck column (kept on the `luck` branch; not shown on main), per kill (or per raid/chest)
// for each tracked boss: "alone" = items that finish the tile by themselves, "count" = items
// that count toward a target (e.g. 3 shards). From OSRS Wiki drop tables (Oct 2026).
// Raids are rough per-player estimates (they depend on points, team size and invocations).
// Yama (contracts) and Doom (rates change with delve level) have no simple rate, so no figure.
export const DRY = {
  1:  {target: 3, rates: {"The Gauntlet": {alone: 1/2000, count: 1/120}, "The Corrupted Gauntlet": {alone: 1/400, count: 1/50}}},
  2:  {rates: {"Hueycoatl": {alone: 1/105}}},
  4:  {approx: true, rates: {"Tombs of Amascut": {alone: 1/75}, "Tombs of Amascut Expert": {alone: 1/40}}},
  5:  {target: 3, rates: {"Phantom Muspah": {count: 1/100}}},
  6:  {rates: {"Maggot King": {alone: 1/520 + 1/340 + 1/3500}}},
  7:  {rates: {"Duke Sucellus": {alone: 3/2160}, "The Leviathan": {alone: 3/2304}, "Vardorvis": {alone: 3/3264}, "The Whisperer": {alone: 3/1536}}},
  9:  {rates: {"Callisto": {alone: 1/360}, "Venenatis": {alone: 1/360}, "Vetion": {alone: 1/360},
               "Artio": {alone: 1/912}, "Spindel": {alone: 1/912}, "Calvarion": {alone: 1/912}}},
  10: {approx: true, rates: {"Theatre of Blood": {alone: 1/63}, "Theatre of Blood Challenge Mode": {alone: 1/55}}},
  11: {target: 3, rates: {"Araxxor": {alone: 1/600, count: 1/200}}},
  13: {barrows: 7/2448},   // each piece, per chest (7 rolls at 1/2448); a set is 4 pieces of one of 6 brothers
  15: {rates: {"Zulrah": {alone: 1/1024}}},
  18: {rates: {"Phosanis Nightmare": {alone: 69/35000 + 3/700 + 31/35000 + 3/1600}}},
  20: {rates: {"Zalcano": {alone: 39/8000}}},
  22: {approx: true, rates: {"Chambers of Xeric": {alone: 1/69}, "Chambers of Xeric Challenge Mode": {alone: 1/55}}},
  24: {rates: {"Cerberus": {alone: 3/520}}}
};

// For each tile: [item name, item ID, counts toward the tile (1) or not (0), Barrows brother].
// Built from TempleOSRS collection log categories.
export const TILE_ITEMS = {
  0:[["Ring of endurance",24844,1],["Hallowed mark",24711,0],["Hallowed token",24719,0],["Hallowed grapple",24721,0],["Hallowed focus",24723,0],["Hallowed symbol",24725,0],["Hallowed hammer",24727,0],["Hallowed ring",24731,0],["Dark dye",24729,0],["Dark acorn",24733,0],["Strange old lockpick (full)",24740,0],["Mysterious page",24763,0]],
  1:[["Enhanced crystal weapon seed",25859,1],["Crystal armour seed",23956,1],["Youngllef",23757,0],["Crystal weapon seed",4207,0],["Gauntlet cape",23859,0]],
  2:[["Dragon hunter wand",30070,1],["Huberte",30152,0],["Tome of Earth (empty)",30066,0],["Soiled page",30068,0],["Hueycoatl hide",30085,0],["Huasca seed",30088,0]],
  3:[["Abyssal orphan",13262,1],["Ikkle Hydra",22746,1],["Callisto cub",13178,1],["Hellpuppy",13247,1],["Pet Chaos Elemental",11995,1],["Pet Zilyana",12651,1],["Pet dark core",12816,1],["Pet Dagannoth Prime",12644,1],["Pet Dagannoth Supreme",12643,1],["Pet Dagannoth Rex",12645,1],["Tzrek-Jad",13225,1],["Pet general Graardor",12650,1],["Baby Mole",12646,1],["Noon",21748,1],["Jal-Nib-Rek",21291,1],["Kalphite Princess",12647,1],["Prince Black Dragon",12653,1],["Pet Kraken",12655,1],["Pet Kree'arra",12649,1],["Pet K'ril Tsutsaroth",12652,1],["Scorpia's offspring",13181,1],["Skotos",21273,1],["Pet Smoke Devil",12648,1],["Venenatis spiderling",13177,1],["Vet'ion Jr.",13179,1],["Vorki",21992,1],["Phoenix",20693,1],["Pet Snakeling",12921,1],["Olmlet",20851,1],["Lil' Zik",22473,1],["Bloodhound",19730,1],["Pet Penance Queen",12703,1],["Heron",13320,1],["Rock golem",13321,1],["Beaver",13322,1],["Baby chinchompa",13324,1],["Giant Squirrel",20659,1],["Tangleroot",20661,1],["Rocky",20663,1],["Rift guardian",20665,1],["Herbi",21509,1],["Chompy chick",13071,1],["Sraracha",23495,1],["Smolcano",23760,1],["Youngllef",23757,1],["Little Nightmare",24491,1],["Lil' Creator",25348,1],["Tiny tempor",25602,1],["Nexling",26348,1],["Abyssal protector",26901,1],["Tumeken's guardian",27352,1],["Muphin",27590,1],["Wisp",28246,1],["Baron",28250,1],["Butch",28248,1],["Lil'viathan",28252,1],["Scurry",28801,1],["Smol Heredit",28960,1],["Quetzin",28962,1],["Nid",29836,1],["Huberte",30152,1],["Moxi",30154,1],["Bran",30622,1],["Yami",30888,1],["Dom",31130,1],["Soup",31283,1],["Gull",31285,1],["Beef",33124,1],["Maggot marquess",33642,1],["Mr McGroot",34040,1],["Aggy",34042,1]],
  4:[["Tumeken's shadow",27277,1],["Elidinis' ward",25985,1],["Masori mask",27226,1],["Masori body",27229,1],["Masori chaps",27232,1],["Tumeken's guardian",27352,0],["Lightbearer",25975,0],["Osmumten's fang",26219,0],["Thread of Elidinis",27279,0],["Breach of the Scarab",27283,0],["Eye of the Corruptor",27285,0],["Jewel of the Sun",27289,0],["Jewel of Amascut",30893,0],["Menaphite ornament kit",27255,0],["Cursed phalanx",27248,0],["Masori crafting kit",27372,0],["Cache of runes",27293,0],["Icthlarin's shroud (tier 1)",27257,0],["Icthlarin's shroud (tier 2)",27259,0],["Icthlarin's shroud (tier 3)",27261,0],["Icthlarin's shroud (tier 4)",27263,0],["Icthlarin's shroud (tier 5)",27265,0],["Remnant of Akkha",27377,0],["Remnant of Ba-Ba",27378,0],["Remnant of Kephri",27379,0],["Remnant of Zebak",27380,0],["Ancient remnant",27381,0]],
  5:[["Venator shard",27614,1],["Muphin",27590,0],["Ancient icon",27627,0],["Charged ice",27643,0],["Frozen cache",27622,0],["Ancient essence",27616,0]],
  6:[["Maggot marquess",33642,1],["Crimson kisten",33631,1],["Elder venator fang",33634,1]],
  7:[["Virtus mask",26241,1],["Virtus robe top",26243,1],["Virtus robe bottom",26245,1],["Baron",28250,0],["Eye of the Duke",28321,0],["Magus vestige",28281,0],["Ice quartz",28270,0],["Frozen tablet",28333,0],["Chromium ingot",28276,0],["Awakener's orb",28334,0],["Lil'viathan",28252,0],["Leviathan's lure",28325,0],["Venator vestige",28283,0],["Smoke quartz",28274,0],["Scarred tablet",28332,0],["Butch",28248,0],["Executioner's axe head",28319,0],["Ultor vestige",28285,0],["Blood quartz",28268,0],["Strangled tablet",28330,0],["Wisp",28246,0],["Siren's staff",28323,0],["Bellator vestige",28279,0],["Shadow quartz",28272,0],["Sirenic tablet",28331,0]],
  8:[["Inky paint",32093,1],["Barracuda paint",32087,0],["Shark paint",32090,0],["Angler's paint",32096,0],["Salvor's paint",32099,0],["Armadylean paint",32102,0],["Zamorakian paint",32104,0],["Guthixian paint",32106,0],["Saradominist paint",32108,0],["Merchant's paint",32110,0],["Sandy paint",32113,0]],
  9:[["Voidwaker hilt",27681,1],["Voidwaker gem",27687,1],["Voidwaker blade",27684,1],["Callisto cub",13178,0],["Tyrannical ring",12603,0],["Dragon pickaxe",11920,0],["Dragon 2h sword",7158,0],["Claws of Callisto",27667,0],["Venenatis spiderling",13177,0],["Treasonous ring",12605,0],["Fangs of Venenatis",27670,0],["Vet'ion Jr.",13179,0],["Ring of the gods",12601,0],["Skull of Vet'ion",27673,0]],
  10:[["Scythe of Vitur",22486,1],["Ghrazi rapier",22324,1],["Sanguinesti staff",22481,1],["Justiciar faceguard",22326,1],["Justiciar chestguard",22327,1],["Justiciar legguards",22328,1],["Lil' Zik",22473,0],["Avernic defender hilt",22477,0],["Vial of blood",22446,0],["Sinhaza shroud tier 1",22494,0],["Sinhaza shroud tier 2",22496,0],["Sinhaza shroud tier 3",22498,0],["Sinhaza shroud tier 4",22500,0],["Sinhaza shroud tier 5",22502,0],["Sanguine dust",25746,0],["Holy ornament kit",25742,0],["Sanguine ornament kit",25744,0]],
  11:[["Araxyte fang",29799,1],["Noxious point",29790,1],["Noxious blade",29792,1],["Noxious pommel",29794,1],["Nid",29836,0],["Araxyte venom sack",29784,0],["Spider cave teleport",29782,0],["Araxyte head",29788,0],["Jar of Venom",29786,0],["Coagulated venom",29781,0]],
  13:[["Karil's coif",4732,1,"Karil"],["Ahrim's hood",4708,1,"Ahrim"],["Dharok's helm",4716,1,"Dharok"],["Guthan's helm",4724,1,"Guthan"],["Torag's helm",4745,1,"Torag"],["Verac's helm",4753,1,"Verac"],["Karil's leathertop",4736,1,"Karil"],["Ahrim's robetop",4712,1,"Ahrim"],["Dharok's platebody",4720,1,"Dharok"],["Guthan's platebody",4728,1,"Guthan"],["Torag's platebody",4749,1,"Torag"],["Verac's brassard",4757,1,"Verac"],["Karil's leatherskirt",4738,1,"Karil"],["Ahrim's robeskirt",4714,1,"Ahrim"],["Dharok's platelegs",4722,1,"Dharok"],["Guthan's chainskirt",4730,1,"Guthan"],["Torag's platelegs",4751,1,"Torag"],["Verac's plateskirt",4759,1,"Verac"],["Karil's crossbow",4734,1,"Karil"],["Ahrim's staff",4710,1,"Ahrim"],["Dharok's greataxe",4718,1,"Dharok"],["Guthan's warspear",4726,1,"Guthan"],["Torag's hammers",4747,1,"Torag"],["Verac's flail",4755,1,"Verac"],["Bolt rack",4740,0]],
  14:[["Pharaoh's sceptre",26945,1]],
  15:[["Tanzanite fang",12922,1],["Pet Snakeling",12921,0],["Tanzanite mutagen",13200,0],["Magma mutagen",13201,0],["Jar of Swamp",12936,0],["Magic fang",12932,0],["Serpentine visage",12927,0],["Zul-andra teleport",12938,0],["Uncut onyx",6571,0],["Zulrah's scales",12934,0]],
  16:[["Golden tench",22840,1],["Pearl fishing rod",22846,0],["Pearl fly fishing rod",22844,0],["Pearl barbarian rod",22842,0],["Fish sack",22838,0],["Angler hat",13258,0],["Angler top",13259,0],["Angler waders",13260,0],["Angler boots",13261,0]],
  17:[["Dragon limbs",21918,1]],
  18:[["Inquisitor's mace",24417,1],["Inquisitor's great helm",24419,1],["Inquisitor's hauberk",24420,1],["Inquisitor's plateskirt",24421,1],["Nightmare staff",24422,1],["Volatile orb",24514,1],["Harmonised orb",24511,1],["Eldritch orb",24517,1],["Little Nightmare",24491,0],["Jar of Dreams",24495,0],["Slepey tablet",25837,0],["Parasitic egg",25838,0]],
  19:[["Soulflame horn",30759,1],["Oathplate helm",30750,1],["Oathplate chest",30753,1],["Oathplate legs",30756,1],["Yami",30888,0],["Chasm teleport scroll",30775,0],["Oathplate shards",30765,0],["Rite of vile transference",30806,0],["Forgotten lockbox",30763,0],["Dossier",30805,0],["Barrel of demonic tallow (full)",30795,0]],
  20:[["Crystal tool seed",23953,1],["Smolcano",23760,0],["Zalcano shard",23908,0],["Uncut onyx",6571,0]],
  21:[["Avernic treads",31088,1],["Eye of Ayak",31115,1],["Mokhaiotl cloth",31109,1],["Mokhaiotl waystone",31099,0],["Dom",31130,0],["Demon tear",31111,0]],
  22:[["Twisted bow",20997,1],["Elder maul",21003,1],["Kodai insignia",21043,1],["Dragon claws",13652,1],["Ancestral hat",21018,1],["Ancestral robe top",21021,1],["Ancestral robe bottom",21024,1],["Dinh's bulwark",21015,1],["Dragon hunter crossbow",21012,1],["Twisted buckler",21000,1],["Olmlet",20851,0],["Metamorphic dust",22386,0],["Dexterous prayer scroll",21034,0],["Arcane prayer scroll",21079,0],["Torn prayer scroll",21047,0],["Dark relic",21027,0],["Onyx",6573,0],["Twisted ancestral colour kit",24670,0],["Xeric's guard",22388,0],["Xeric's warrior",22390,0],["Xeric's sentinel",22392,0],["Xeric's general",22394,0],["Xeric's champion",22396,0]],
  23:[["Zenyte shard",19529,1],["Light frame",19586,0],["Heavy frame",19589,0],["Ballista limbs",19592,0],["Monkey tail",19610,0],["Ballista spring",19601,0]],
  24:[["Eternal crystal",13227,1],["Pegasian crystal",13229,1],["Primordial crystal",13231,1],["Hellpuppy",13247,0],["Jar of Souls",13245,0],["Smouldering stone",13233,0],["Key master teleport",13249,0]]
};
