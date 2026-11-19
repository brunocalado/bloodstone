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

/** Action Roll results, v1.4 player scroll. */
export const ACTION_TIERS = {
  critical: { label: "Critical", text: "They succeed with increased Effect." },
  success: { label: "Success", text: "It goes as well as intended." },
  partial: {
    label: "Partial Success",
    text: "They do it but also suffer a Consequence: Harm, Reduced Effect, Lost Opportunity, Worse Position or Complication."
  },
  fail: { label: "Fail", text: "Things go bad and they suffer the Consequences." }
};

/** Resist results, v1.4 player scroll. */
export const RESIST_TIERS = {
  critical: { label: "Perfect", text: "You avoid the consequence completely and refresh 1 Blood." },
  success: { label: "Good", text: "You avoid the consequence completely." },
  partial: { label: "Close", text: "You partially reduce the consequence." },
  fail: { label: "Bad", text: "You suffer the full consequence." }
};

export const POSITIONS = ["controlled", "risky", "desperate"];
export const EFFECTS = ["limited", "standard", "great"];

/** Firearm thresholds, v1.4 player sheet. Items name theirs in flags[MODULE_ID].firearm. */
export const FIREARMS = {
  pistol:      { label: "Pistol",      parry: 4, stun: 6 },
  blunderbuss: { label: "Blunderbuss", parry: 6, stun: 4 },
  rifle:       { label: "Rifle",       parry: 5, stun: 5 }
};

/** Trick weapons: base | alternate form. Items name theirs in flags[MODULE_ID].trickWeapon. */
export const TRICK_WEAPONS = {
  axe:     { base: "Axe",     alternate: "Long Axe",  trait: "great range" },
  blade:   { base: "Blade",   alternate: "Mallet",    trait: "+Effect vs undead" },
  cleaver: { base: "Cleaver", alternate: "Saw Spear", trait: "+Effect vs beast" }
};
