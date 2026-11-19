/*!
 * Bloodstone - Action-Horror mini Forged in the Dark
 * 2022 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Bloodstone's rolls, exposed as the global `bloodstone`. Pack macros are one-line calls into these, and
 * TAF's Roll / Use buttons run those macros, so the logic lives here as reviewable module code
 * instead of script strings escaped into compendium JSON. A chat-type trigger macro
 * (`/r @active.value d6`) would need no code, but it cannot read the result tier, apply the
 * zero-dice rule (roll 2, keep the lowest) or add Push and bonus dice.
 *
 * Nothing is deducted from the actor. Under v1.4, Stamina spent on a failed roll is regained only
 * after the Consequence lands, and the GM sets Consequences in the fiction, so automating the
 * spend would fight the table. Each chat card ends with a reminder of what to mark instead.
 */

import { MODULE_ID, ACTIONS, POSITIONS, EFFECTS, FIREARMS, TRICK_WEAPONS } from "./constants.js";

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
  const flagged = item?.getFlag(MODULE_ID, "trickWeapon");
  const weapon = TRICK_WEAPONS.includes(flagged) ? {
    base: t(`TrickWeapon.${flagged}.Base`),
    alternate: t(`TrickWeapon.${flagged}.Alternate`),
    trait: t(`TrickWeapon.${flagged}.Trait`)
  } : null;
  const preselected = ACTIONS.includes(item?.system?.key) ? item.system.key : ACTIONS[0];

  const actions = ACTIONS.map(key => {
    const attr = actor.getAttribute(key);
    const name = attr?.name ?? t(`Attribute.${key}`);
    const value = attr?.system.value ?? 0;
    return { value: key, label: `${name} (${value})`, selected: key === preselected, name, rating: value };
  });

  const fields = [
    selectField("action", t("Field.Action"), actions),
    selectField("push", t("Field.Push"), range(0, 3)),
    selectField("bonus", t("Field.Bonus"), range(0, 3)),
    selectField("position", t("Field.Position"),
      POSITIONS.map(p => ({ value: p, label: t(`Position.${p}`), selected: p === "risky" }))),
    selectField("effect", t("Field.Effect"),
      EFFECTS.map(e => ({ value: e, label: t(`Effect.${e}`), selected: e === "standard" })))
  ];
  if (weapon) {
    const blood = actor.getAttribute("blood")?.system.value ?? 0;
    fields.push(
      selectField("form", t("Field.Form"), [
        { value: "base", label: t("Form.Base", { form: weapon.base }), selected: true },
        { value: "alternate", label: t("Form.Alternate", { form: weapon.alternate }) }
      ]),
      selectField("imbrue", t("Field.Imbrue"), range(0, Math.max(blood, 0)))
    );
  }

  const data = await DialogV2.input({
    window: { title: t(weapon ? "Dialog.TrickWeapon" : "Dialog.ActionRoll"), icon: "fa-solid fa-dice-d6" },
    content: fields.join(""),
    ok: { label: t("Dialog.Roll"), icon: "fa-solid fa-dice-d6" }
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
  if (push) dice.push(t("Card.Push", { n: push }));
  if (bonus) dice.push(t("Card.Bonus", { n: bonus }));
  if (imbrue) dice.push(t("Card.Imbrue", { n: imbrue }));

  const position = POSITIONS.includes(data.position) ? data.position : "risky";
  const details = [
    t(alternate ? "Card.PositionEffectRaised" : "Card.PositionEffect",
      { position: t(`Position.${position}`), effect: t(`Effect.${effect}`) }),
    pool > 0 ? t("Card.Pool", { pool, dice: dice.join(" + ") }) : t("Card.ZeroDice", { dice: dice.join(" + ") })
  ];
  if (weapon) details.unshift(`${item.name}: ${alternate ? weapon.alternate : weapon.base} (${weapon.trait})`);

  const stamina = push + (weapon ? (alternate ? 2 : 1) : 0);
  const marks = [];
  if (stamina) {
    const why = [push && t("Mark.Push", { n: push }), weapon && t(alternate ? "Mark.AlternateForm" : "Mark.BaseForm")];
    marks.push(t("Mark.Stamina", { n: stamina, why: why.filter(Boolean).join(", ") }));
  }
  if (imbrue) marks.push(t("Mark.Imbrued", { n: imbrue }));

  await post(roll, actor, {
    title: weapon ? t("Dialog.TrickWeapon") : t("Card.ActionRollTitle", { action: action.name }),
    details,
    tier,
    label: t(`ActionTier.${tier}.Label`),
    text: t(`ActionTier.${tier}.Text`),
    reminder: marks.length
      ? t("Reminder.Mark", { marks: game.i18n.getListFormatter().format(marks) })
      : t("Reminder.Nothing")
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
    window: { title: t("Dialog.Resist"), icon: "fa-solid fa-shield-halved" },
    content: selectField("stamina", t("Field.StaminaSpent"), range(1, 3)),
    ok: { label: t("Dialog.Roll"), icon: "fa-solid fa-dice-d6" }
  });
  if (!data) return;

  const stamina = Math.max(Number(data.stamina) || 1, 1);
  const roll = await new foundry.dice.Roll(`${stamina}d6kh`).evaluate();
  const tier = tierOf(readDice(roll));

  await post(roll, actor, {
    title: t("Dialog.Resist"),
    details: [t("Card.ResistPool", { n: stamina })],
    tier,
    label: t(`ResistTier.${tier}.Label`),
    text: t(`ResistTier.${tier}.Text`),
    reminder: t(tier === "critical" ? "Reminder.ResistPerfect" : "Reminder.Resist", { n: stamina })
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
    selectField("firearm", t("Field.Firearm"), Object.entries(FIREARMS).map(([key, f]) => ({
      value: key,
      label: t("Firearm.Option", { firearm: t(`Firearm.${key}`), parry: f.parry, stun: f.stun }),
      selected: key === preselected
    }))),
    selectField("action", t("Field.Action"), [
      { value: "parry", label: t("FirearmAction.ParryOption"), selected: true },
      { value: "stun", label: t("FirearmAction.StunOption") },
      { value: "reload", label: t("FirearmAction.ReloadOption") }
    ]),
    selectField("marked", t("Field.Marked"), range(1, 6)),
    selectField("bonus", t("Field.ReloadBonus"), range(0, 3))
  ].join("");

  const data = await DialogV2.input({
    window: { title: t("Dialog.Firearm"), icon: "fa-solid fa-gun" },
    content,
    ok: { label: t("Dialog.Roll"), icon: "fa-solid fa-dice-d6" }
  });
  if (!data) return;

  const gunKey = data.firearm in FIREARMS ? data.firearm : preselected;
  const gun = FIREARMS[gunKey];
  const gunLabel = t(`Firearm.${gunKey}`);
  const action = ["parry", "stun", "reload"].includes(data.action) ? data.action : "parry";
  const actionLabel = t(`FirearmAction.${action}`);
  const marked = Math.max(Number(data.marked) || 1, 1);
  const bonus = Number(data.bonus) || 0;

  const dice = { parry: marked, stun: Math.floor(marked / 2), reload: marked + bonus }[action];
  if (dice < 1) {
    ui.notifications.warn(t("Notify.StunTooFew"));
    return;
  }

  const roll = await new foundry.dice.Roll(`${dice}d6kh`).evaluate();
  const { highest } = readDice(roll);
  const title = `${item ? item.name : gunLabel}: ${actionLabel}`;

  if (action === "reload") {
    // One key per number form: English and Portuguese both inflect the noun, so "bullet" + "s" can't be built in code.
    const one = highest === 1;
    await post(roll, actor, {
      title,
      details: [t(bonus ? "Card.ReloadPoolBonus" : "Card.ReloadPool", { dice, marked, bonus })],
      tier: "neutral",
      label: actionLabel,
      text: t(one ? "Card.RegainBullet" : "Card.RegainBullets", { n: highest }),
      reminder: t(one ? "Reminder.ReloadBullet" : "Reminder.ReloadBullets", { marked, n: highest })
    });
    return;
  }

  const threshold = gun[action];
  const hit = highest >= threshold;
  await post(roll, actor, {
    title,
    details: [t("Card.FirearmPool", { dice, marked, firearm: gunLabel, action: actionLabel, threshold })],
    tier: hit ? "success" : "fail",
    label: t(`ActionTier.${hit ? "success" : "fail"}.Label`),
    text: t(`FirearmOutcome.${action}${hit ? "Hit" : "Miss"}`),
    reminder: t(marked === 1 ? "Reminder.SilverBullet" : "Reminder.SilverBullets", { n: marked })
  });
}

/**
 * One window with a button per roll, so the hotbar needs a single macro. Trick weapons get a
 * button each, from the actor's own items: without the item the Action Roll has no form or
 * Imbrue to offer.
 * @param {{actor?: Actor}} scope
 */
export async function rollMenu({ actor } = {}) {
  actor = resolveActor(null, actor);
  if (!actor) return;
  const weapons = actor.items.filter(i => TRICK_WEAPONS.includes(i.getFlag(MODULE_ID, "trickWeapon")));

  const choice = await DialogV2.wait({
    window: { title: t("Dialog.Rolls"), icon: "fa-solid fa-dice-d6" },
    content: `<p>${t("Dialog.ChooseRoll", { name: escapeHTML(actor.name) })}</p>`,
    buttons: [
      { action: "action", label: t("Dialog.ActionRoll"), icon: "fa-solid fa-dice-d6" },
      { action: "resist", label: t("Dialog.Resist"), icon: "fa-solid fa-shield-halved" },
      { action: "firearm", label: t("Dialog.Firearm"), icon: "fa-solid fa-gun" },
      ...weapons.map(w => ({ action: `trick-${w.id}`, label: w.name, icon: "fa-solid fa-axe" }))
    ]
  });

  if (choice === "action") return actionRoll({ actor });
  if (choice === "resist") return resist({ actor });
  if (choice === "firearm") return firearm({ actor });
  const weapon = weapons.find(w => choice === `trick-${w.id}`);
  if (weapon) return actionRoll({ item: weapon });
}

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

/** The actor rolling: the clicked item's owner, else the macro's speaker. */
function resolveActor(item, actor) {
  const owner = item?.parent ?? actor;
  if (!owner) ui.notifications.warn(t("Notify.NoActor"));
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

/** A string from lang/, translated when the roll runs: the client's language, never a stored one. */
function t(key, data) {
  return game.i18n.localize(`BLOODSTONE.${key}`, data);
}
