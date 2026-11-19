/*!
 * Bloodstone - Action-Horror mini Forged in the Dark
 * 2022 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import { MODULE_ID } from "./constants.js";
import { actionRoll, resist, firearm } from "./rolls.js";

Hooks.once("init", () => {
  // Pack macros are one-line calls into this, so the roll logic lives in reviewable module code.
  game.modules.get(MODULE_ID).api = { actionRoll, resist, firearm };
});
