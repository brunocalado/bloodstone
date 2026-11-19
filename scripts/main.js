/*!
 * Bloodstone - Action-Horror mini Forged in the Dark
 * 2022 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import { MODULE_ID } from "./constants.js";
import { actionRoll, resist, firearm, rollMenu } from "./rolls.js";
import { startHunt } from "./hunt.js";

Hooks.once("init", () => {
  // Pack macros are one-line calls into this, so the roll logic lives in reviewable module code.
  // A global named after the module keeps those calls short: bloodstone.actionRoll().
  globalThis[MODULE_ID] = { actionRoll, resist, firearm, rollMenu, startHunt };
});
