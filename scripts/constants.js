/*!
 * Bloodstone - Action-Horror mini Forged in the Dark
 * 2022 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

export const MODULE_ID = "bloodstone";

/** Attribute keys the Hunter actor carries (TAF `system.key`). */
export const ACTIONS = ["prowess", "resolve", "wit"];

// Display text lives in lang/, because this file is evaluated at import, before translations load.

export const POSITIONS = ["controlled", "risky", "desperate"];
export const EFFECTS = ["limited", "standard", "great"];

/** Firearm thresholds, v1.4 player sheet. Items name theirs in flags[MODULE_ID].firearm. */
export const FIREARMS = {
  pistol:      { parry: 4, stun: 6 },
  blunderbuss: { parry: 6, stun: 4 },
  rifle:       { parry: 5, stun: 5 }
};

/** Trick weapons (base | alternate form, in lang/). Items name theirs in flags[MODULE_ID].trickWeapon. */
export const TRICK_WEAPONS = ["axe", "blade", "cleaver"];

/**
 * Documents of the imported Adventure that the hunt setup reads. Both language packs give their
 * documents the same ids, so these resolve whichever language the GM imported.
 */
export const ADVENTURE = {
  scene: "B6MTdXU9tuErrttX",
  gmJournal: "KT3p508DoTmbDRWs",
  cathedralsPage: "OMvjkDCxvfWb3pYU",
  nightsClockMacro: "LFbTwb5WL1Tsw1Wv",
  tables: {
    apostle: "oqSBhU20UnvDmmxi",
    obstacle: "zlIGtpk250Xvl0lr",
    location: "4eMPkdxSJnVgxK3j",
    character: "wHFvCk1a9gXRyxzs"
  }
};

/**
 * Map of Heliwyr pixels of the five cathedral markers, in the order The Cathedrals page lists
 * them: Black Chains, Wandering Shadows, Broken Dawn, Divine Blood, the ink-blotted one. Each
 * marker's glyph matches the one under its entry in the map's left pane.
 */
export const CATHEDRAL_POINTS = [
  { x: 1635, y: 516 },
  { x: 1944, y: 1881 },
  { x: 3081, y: 1896 },
  { x: 2535, y: 1125 },
  { x: 3795, y: 666 }
];

/** Fixed spots for location notes, just below each district label printed on the map (names in lang/). */
export const DISTRICTS = {
  oldHeliwyr:      { x: 1599, y: 450 },
  whispering:      { x: 2961, y: 620 },
  twilight:        { x: 2328, y: 815 },
  forgotten:       { x: 4176, y: 1163 },
  alchemists:      { x: 1935, y: 1298 },
  centralHeliwyr:  { x: 3198, y: 1292 },
  drowned:         { x: 2040, y: 1748 },
  firstDawn:       { x: 3306, y: 1760 },
  lanternAlleys:   { x: 2628, y: 2162 }
};

/** How many locations the hunt lays out between the arrival and the cathedral. */
export const HUNT_LOCATIONS = 3;
