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
