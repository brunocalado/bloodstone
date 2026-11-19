/*!
 * Bloodstone - Action-Horror mini Forged in the Dark
 * 2022 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Bloodstone's rolls, exposed as the module API. Pack macros are one-line calls into these, and
 * TAF's Roll / Use buttons run those macros, so the logic lives here as reviewable module code
 * instead of script strings escaped into compendium JSON.
 *
 * Nothing is deducted from the actor. Under v1.4, Stamina spent on a failed roll is regained only
 * after the Consequence lands, and the GM sets Consequences in the fiction, so automating the
 * spend would fight the table. Each chat card ends with a reminder of what to mark instead.
 */

import {
  MODULE_ID, ACTIONS, ACTION_TIERS, RESIST_TIERS, POSITIONS, EFFECTS, FIREARMS, TRICK_WEAPONS
} from "./constants.js";

const { DialogV2 } = foundry.applications.api;
const { escapeHTML } = foundry.utils;

/* -------------------------------------------- */
/*  Entry points                                */
/* -------------------------------------------- */

/**
 * Action Roll. With a trick weapon item (flags[MODULE_ID].trickWeapon) it adds the weapon's form
 * and the Imbrue dice.
 * @param {{item?: Item, actor?: Actor}} scope  What the macro received: the clicked `item` when a
 *                                              TAF button ran it, the speaker's `actor` otherwise.
 */
export async function actionRoll({ item, actor } = {}) {
  actor = resolveActor(item, actor);
  if (!actor) return;
  const weapon = TRICK_WEAPONS[item?.getFlag(MODULE_ID, "trickWeapon")];
  const preselected = ACTIONS.includes(item?.system?.key) ? item.system.key : ACTIONS[0];

  const actions = ACTIONS.map(key => {
    const attr = actor.getAttribute(key);
    const name = attr?.name ?? capitalize(key);
    const value = attr?.system.value ?? 0;
    return { value: key, label: `${name} (${value})`, selected: key === preselected, name, rating: value };
  });

  const fields = [
    selectField("action", "Action", actions),
    selectField("push", "Push (Stamina)", range(0, 3)),
    selectField("bonus", "Bonus dice (Assist, Attire, Origin)", range(0, 3)),
    selectField("position", "Position", POSITIONS.map(p => ({ value: p, label: capitalize(p), selected: p === "risky" }))),
    selectField("effect", "Effect", EFFECTS.map(e => ({ value: e, label: capitalize(e), selected: e === "standard" })))
  ];
  if (weapon) {
    const blood = actor.getAttribute("blood")?.system.value ?? 0;
    fields.push(
      selectField("form", "Form", [
        { value: "base", label: `${weapon.base}: base form (1 Stamina)`, selected: true },
        { value: "alternate", label: `${weapon.alternate}: alternate form (2 Stamina, increased Effect)` }
      ]),
      selectField("imbrue", "Imbrue (Blood)", range(0, Math.max(blood, 0)))
    );
  }

  const data = await DialogV2.input({
    window: { title: weapon ? "Trick Weapon" : "Action Roll", icon: "fa-solid fa-dice-d6" },
    content: fields.join(""),
    ok: { label: "Roll", icon: "fa-solid fa-dice-d6" }
  });
  if (!data) return;

  const action = actions.find(a => a.value === data.action) ?? actions[0];
  const push = Number(data.push) || 0;
  const bonus = Number(data.bonus) || 0;
  const imbrue = weapon ? Number(data.imbrue) || 0 : 0;
  const alternate = weapon && (data.form === "alternate");
  const pool = action.rating + push + bonus + imbrue;

  // v1.4: with zero or less dice, roll two and keep the lowest; that roll can never be a critical.
  const roll = await new foundry.dice.Roll(pool > 0 ? `${pool}d6kh` : "2d6kl").evaluate();
  const tier = tierOf(readDice(roll));

  let effect = EFFECTS.includes(data.effect) ? data.effect : "standard";
  if (alternate) effect = EFFECTS[Math.min(EFFECTS.indexOf(effect) + 1, EFFECTS.length - 1)];

  const dice = [`${action.name} ${action.rating}`];
  if (push) dice.push(`Push ${push}`);
  if (bonus) dice.push(`Bonus ${bonus}`);
  if (imbrue) dice.push(`Imbrue ${imbrue}`);

  const details = [
    `${capitalize(POSITIONS.includes(data.position) ? data.position : "risky")} position, ${capitalize(effect)} effect`
      + (alternate ? " (raised by the alternate form)" : ""),
    pool > 0 ? `${pool}d: ${dice.join(" + ")}` : `${dice.join(" + ")}: zero dice, rolled 2 and kept the lowest`
  ];
  if (weapon) details.unshift(`${item.name}: ${alternate ? weapon.alternate : weapon.base} (${weapon.trait})`);

  const stamina = push + (weapon ? (alternate ? 2 : 1) : 0);
  const marks = [];
  if (stamina) {
    const why = [push && `${push} Push`, weapon && `${alternate ? 2 : 1} ${alternate ? "alternate" : "base"} form`];
    marks.push(`${stamina} Stamina (${why.filter(Boolean).join(", ")})`);
  }
  if (imbrue) marks.push(`${imbrue} Blood (Imbrued)`);

  await post(roll, actor, {
    title: weapon ? "Trick Weapon" : `Action Roll: ${action.name}`,
    details,
    tier,
    label: ACTION_TIERS[tier].label,
    text: ACTION_TIERS[tier].text,
    reminder: marks.length ? `Mark ${marks.join(" and ")}.` : "Nothing to mark."
  });
}

/**
 * Resist: 1d per Stamina spent.
 * @param {{item?: Item, actor?: Actor}} scope
 */
export async function resist({ item, actor } = {}) {
  actor = resolveActor(item, actor);
  if (!actor) return;

  const data = await DialogV2.input({
    window: { title: "Resist", icon: "fa-solid fa-shield-halved" },
    content: selectField("stamina", "Stamina spent", range(1, 3)),
    ok: { label: "Roll", icon: "fa-solid fa-dice-d6" }
  });
  if (!data) return;

  const stamina = Math.max(Number(data.stamina) || 1, 1);
  const roll = await new foundry.dice.Roll(`${stamina}d6kh`).evaluate();
  const tier = tierOf(readDice(roll));

  await post(roll, actor, {
    title: "Resist",
    details: [`${stamina}d: Stamina spent`],
    tier,
    label: RESIST_TIERS[tier].label,
    text: RESIST_TIERS[tier].text,
    reminder: `Mark ${stamina} Stamina (Resist).` + (tier === "critical" ? " Refresh 1 Blood." : "")
  });
}

/**
 * Firearm: Parry, Stun or Reload.
 * @param {{item?: Item, actor?: Actor}} scope
 */
export async function firearm({ item, actor } = {}) {
  actor = resolveActor(item, actor);
  if (!actor) return;
  const flagged = item?.getFlag(MODULE_ID, "firearm");
  const preselected = flagged in FIREARMS ? flagged : Object.keys(FIREARMS)[0];

  const content = [
    selectField("firearm", "Firearm", Object.entries(FIREARMS).map(([key, f]) => ({
      value: key, label: `${f.label} (Parry ${f.parry}+, Stun ${f.stun}+)`, selected: key === preselected
    }))),
    selectField("action", "Action", [
      { value: "parry", label: "Parry: 1d per bullet marked", selected: true },
      { value: "stun", label: "Stun: 1d per two bullets marked" },
      { value: "reload", label: "Reload: 1d per Blood or bullet marked" }
    ]),
    selectField("marked", "Bullets / Blood marked", range(1, 6)),
    selectField("bonus", "Bonus dice (Reload only, e.g. Noble Scion)", range(0, 3))
  ].join("");

  const data = await DialogV2.input({
    window: { title: "Firearm", icon: "fa-solid fa-gun" },
    content,
    ok: { label: "Roll", icon: "fa-solid fa-dice-d6" }
  });
  if (!data) return;

  const gun = FIREARMS[data.firearm] ?? FIREARMS[preselected];
  const action = ["parry", "stun", "reload"].includes(data.action) ? data.action : "parry";
  const marked = Math.max(Number(data.marked) || 1, 1);
  const bonus = Number(data.bonus) || 0;

  const dice = { parry: marked, stun: Math.floor(marked / 2), reload: marked + bonus }[action];
  if (dice < 1) {
    ui.notifications.warn("Stun rolls 1 die per two bullets marked: mark at least 2.");
    return;
  }

  const roll = await new foundry.dice.Roll(`${dice}d6kh`).evaluate();
  const { highest } = readDice(roll);
  const title = item ? `${item.name}: ${capitalize(action)}` : `${gun.label}: ${capitalize(action)}`;

  if (action === "reload") {
    await post(roll, actor, {
      title,
      details: [`${dice}d: ${marked} marked` + (bonus ? ` + ${bonus} bonus` : "")],
      tier: "neutral",
      label: "Reload",
      text: `Regain ${plural(highest, "bullet")}.`,
      reminder: `Mark ${marked} Blood and/or Silver Bullets, then regain ${plural(highest, "bullet")}.`
    });
    return;
  }

  const threshold = gun[action];
  const hit = highest >= threshold;
  const outcome = {
    parry: hit ? "You interrupt an enemy action." : "The enemy action is not interrupted.",
    stun: hit ? "You stun an enemy for a few seconds." : "The enemy is not stunned."
  }[action];
  await post(roll, actor, {
    title,
    details: [`${dice}d: ${marked} bullets marked, ${gun.label} ${capitalize(action)} ${threshold}+`],
    tier: hit ? "success" : "fail",
    label: hit ? "Success" : "Fail",
    text: outcome,
    reminder: `Mark ${plural(marked, "Silver Bullet")}.`
  });
}

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

/** The actor rolling: the clicked item's owner, else the macro's speaker. */
function resolveActor(item, actor) {
  const owner = item?.parent ?? actor;
  if (!owner) ui.notifications.warn("Select your Hunter's token or assign a character.");
  return owner ?? null;
}

/** Highest die and count of sixes, honouring kl on the zero-dice roll. */
function readDice(roll) {
  const die = roll.dice[0];
  const kept = die.results.filter(r => r.active).map(r => r.result);
  // kh keeps one die, but every six rolled counts towards a critical; kl keeps only the lowest,
  // which is why the zero-dice roll can never show two sixes.
  const counted = die.modifiers.includes("kl") ? kept : die.results.map(r => r.result);
  return { highest: Math.max(...kept), sixes: counted.filter(n => n === 6).length };
}

/** The v1.4 result tier from the dice read. */
function tierOf({ highest, sixes }) {
  if (sixes >= 2) return "critical";
  if (highest === 6) return "success";
  if (highest >= 4) return "partial";
  return "fail";
}

/**
 * Posts the roll as one chat message with the result card as its flavor. Every string is
 * escaped here, since item and attribute names are player-editable and the flavor is HTML
 * rendered on every client.
 */
async function post(roll, actor, { title, details, tier, label, text, reminder }) {
  const flavor = `<div class="bloodstone roll-card ${tier}">`
    + `<header class="title">${escapeHTML(title)}</header>`
    + details.map(d => `<p class="detail">${escapeHTML(d)}</p>`).join("")
    + `<p class="result"><strong>${escapeHTML(label)}.</strong> ${escapeHTML(text)}</p>`
    + `<p class="reminder">${escapeHTML(reminder)}</p>`
    + `</div>`;
  return roll.toMessage({
    speaker: foundry.documents.ChatMessage.implementation.getSpeaker({ actor }),
    flavor
  });
}

/** A labelled <select>; option labels may come from documents, so they are escaped. */
function selectField(name, label, options) {
  const opts = options.map(o => `<option value="${escapeHTML(o.value)}"${o.selected ? " selected" : ""}>`
    + `${escapeHTML(o.label)}</option>`).join("");
  return `<div class="form-group"><label>${escapeHTML(label)}</label>`
    + `<div class="form-fields"><select name="${name}">${opts}</select></div></div>`;
}

/** Options for every integer from min to max, the first one selected. */
function range(min, max) {
  return Array.from({ length: max - min + 1 }, (_, i) => ({ value: min + i, label: String(min + i), selected: i === 0 }));
}

function plural(n, noun) {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
