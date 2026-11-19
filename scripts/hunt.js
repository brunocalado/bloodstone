/*!
 * Bloodstone - Action-Horror mini Forged in the Dark
 * 2022 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * The GM's start-of-session setup, exposed as `bloodstone.startHunt()`. One window draws the
 * secret cathedral, the Apostle, the locations, the opening obstacle and a weird character, and
 * lets the GM change any of them. Confirming starts the Night's Clock, writes a GM-only journal
 * with a page per choice, and pins those pages to the Map of Heliwyr as notes.
 *
 * Everything is read from the imported Adventure by id, never from the compendium: both language
 * packs share their ids, so the hunt comes out in whichever language the GM imported.
 */

import {
  MODULE_ID, ADVENTURE, CATHEDRAL_POINTS, DISTRICTS, HUNT_LOCATIONS
} from "./constants.js";

const { DialogV2 } = foundry.applications.api;
const { escapeHTML, randomID } = foundry.utils;

const CATHEDRAL_ICON = "icons/svg/temple.svg";
const LOCATION_ICON = "icons/svg/city.svg";

export async function startHunt() {
  if (!game.user.isGM) {
    ui.notifications.warn(t("Hunt.Notify.GMOnly"));
    return;
  }
  const scene = game.scenes.get(ADVENTURE.scene);
  const tables = Object.fromEntries(Object.entries(ADVENTURE.tables).map(([k, id]) => [k, game.tables.get(id)]));
  const cathedrals = readCathedrals();
  if (!scene || Object.values(tables).some(tb => !tb) || (cathedrals.length !== CATHEDRAL_POINTS.length)) {
    ui.notifications.error(t("Hunt.Notify.Missing"));
    return;
  }

  // One entry per <select>. `group` keeps the selects that share it on different values, so the
  // locations and their districts never repeat when drawn.
  const fields = [
    { name: "cathedral", label: t("Hunt.Field.Cathedral"),
      options: cathedrals.map((c, i) => ({ value: String(i), label: c.name })) },
    tableField("apostle", t("Hunt.Field.Apostle"), tables.apostle),
    tableField("obstacle", t("Hunt.Field.Obstacle"), tables.obstacle),
    tableField("character", t("Hunt.Field.Character"), tables.character)
  ];
  const districtOptions = Object.keys(DISTRICTS).map(key => ({ value: key, label: t(`Hunt.District.${key}`) }));
  for (let n = 0; n < HUNT_LOCATIONS; n++) {
    fields.push(
      { ...tableField(`location${n}`, t("Hunt.Field.Location", { n: n + 1 }), tables.location), group: "location" },
      { name: `district${n}`, label: t("Hunt.Field.District", { n: n + 1 }), options: districtOptions, group: "district" }
    );
  }

  const chosen = {};
  for (const field of fields) {
    const taken = fields.filter(f => f.group && (f.group === field.group)).map(f => chosen[f.name]);
    chosen[field.name] = await draw(field, taken);
  }

  const data = await DialogV2.input({
    window: { title: t("Hunt.Title"), icon: "fa-solid fa-moon" },
    position: { width: 520 },
    content: `<p>${escapeHTML(t("Hunt.Intro"))}</p>`
      + `<button type="button" data-reroll-all><i class="fa-solid fa-dice"></i> ${escapeHTML(t("Hunt.RerollAll"))}</button>`
      + fields.map(f => selectField(f, chosen[f.name])).join(""),
    ok: { label: t("Hunt.Start"), icon: "fa-solid fa-moon" },
    render: (_event, dialog) => {
      // Draws run one after another: two in flight at once would each exclude the other's old
      // value and could land on the same location.
      let queue = Promise.resolve();
      dialog.element.querySelectorAll("button[data-reroll]").forEach(button => {
        button.addEventListener("click", () => queue = queue.then(async () => {
          const field = fields.find(f => f.name === button.dataset.reroll);
          const form = button.form;
          const taken = fields.filter(f => (f === field) || (f.group && (f.group === field.group)))
            .map(f => form.elements[f.name].value);
          form.elements[field.name].value = await draw(field, taken);
        }));
      });
      // Draws every field afresh. A field only avoids the group values already drawn in this pass,
      // so it may land on its previous value, as a fresh roll would.
      const all = dialog.element.querySelector("button[data-reroll-all]");
      all.addEventListener("click", () => queue = queue.then(async () => {
        const form = all.form;
        const drawn = {};
        for (const field of fields) {
          const taken = fields.filter(f => f.group && (f.group === field.group) && (f.name in drawn)).map(f => drawn[f.name]);
          drawn[field.name] = form.elements[field.name].value = await draw(field, taken);
        }
      }));
    }
  });
  if (!data) return;

  const cathedral = cathedrals[Number(data.cathedral)] ?? cathedrals[0];
  const point = CATHEDRAL_POINTS[cathedrals.indexOf(cathedral)];
  const result = key => tables[key].results.get(data[key]);
  const apostle = result("apostle");
  const obstacle = result("obstacle");
  const character = result("character");
  const locations = Array.from({ length: HUNT_LOCATIONS }, (_, n) => {
    const district = (data[`district${n}`] in DISTRICTS) ? data[`district${n}`] : Object.keys(DISTRICTS)[n];
    return { id: randomID(), result: tables.location.results.get(data[`location${n}`]), district };
  });

  // Page ids are set here so the pages can link to each other in the one create call below.
  const ids = { overview: randomID(), cathedral: randomID(), apostle: randomID(), obstacle: randomID(),
    character: randomID() };
  const link = (id, name) => `@UUID[.${id}]{${escapeHTML(name)}}`;
  const cathedralLink = link(ids.cathedral, cathedral.name);
  const apostleLink = link(ids.apostle, apostle.name);
  const route = [escapeHTML(t("Hunt.Overview.Start")), ...locations.map(l => link(l.id, l.result.name)), cathedralLink];

  const pages = [
    page(ids.overview, t("Hunt.Page.Overview"),
      `<h2>${escapeHTML(t("Hunt.Overview.Route"))}</h2><p>${route.join(" → ")}</p>`
      + `<h2>${escapeHTML(t("Hunt.Overview.Opening"))}</h2>`
      + `<p>${t("Hunt.Overview.OpeningText", {
        obstacle: link(ids.obstacle, obstacle.name), character: link(ids.character, character.name) })}</p>`
      + `<h2>${escapeHTML(t("Hunt.Overview.Prepare"))}</h2><ul>`
      + ["Clock", "Describe", "Points", "Enemies"].map(k => `<li><p>${escapeHTML(t(`Hunt.Overview.${k}`))}</p></li>`).join("")
      + `</ul>`),
    page(ids.cathedral, cathedral.name,
      `<blockquote><p>${t("Hunt.Cathedral.Secret", { apostle: apostleLink })}</p></blockquote>${cathedral.html}`),
    page(ids.apostle, apostle.name,
      `${apostle.description}<p>${t("Hunt.Apostle.Where", { cathedral: cathedralLink })}</p>`
      + `<p><em>${escapeHTML(t("Hunt.Apostle.Prompt"))}</em></p>`),
    ...locations.map((l, n) => {
      const next = locations[n + 1];
      return page(l.id, l.result.name,
        l.result.description
        + `<p><strong>${escapeHTML(t("Hunt.Location.District"))}:</strong> ${escapeHTML(t(`Hunt.District.${l.district}`))}</p>`
        + `<p><strong>${escapeHTML(t("Hunt.Location.LeadsTo"))}:</strong> ${next ? link(next.id, next.result.name) : cathedralLink}</p>`
        + `<h2>${escapeHTML(t("Hunt.Location.Points"))}</h2>`
        + `<p><em>${escapeHTML(t("Hunt.Location.PointsHint"))}</em></p><ol><li><p>…</p></li><li><p>…</p></li><li><p>…</p></li></ol>`
        + `<h2>${escapeHTML(t("Hunt.Location.Enemies"))}</h2><p>…</p>`);
    }),
    page(ids.obstacle, t("Hunt.Page.Obstacle"),
      `<h2>${escapeHTML(obstacle.name)}</h2>${obstacle.description}<p><em>${escapeHTML(t("Hunt.Obstacle.Text"))}</em></p>`),
    page(ids.character, t("Hunt.Page.Character"), `<h2>${escapeHTML(character.name)}</h2>${character.description}`)
  ].map((p, i) => ({ ...p, sort: (i + 1) * 100000 }));

  const journal = await foundry.documents.JournalEntry.implementation.create({
    name: t("Hunt.JournalName", { apostle: apostle.name }),
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
    flags: { [MODULE_ID]: { hunt: true } },
    pages
  });

  // A re-run replaces the previous hunt's notes; its journal stays, since the GM may have written in it.
  const stale = scene.notes.filter(n => n.getFlag(MODULE_ID, "hunt")).map(n => n.id);
  if (stale.length) await scene.deleteEmbeddedDocuments("Note", stale);
  await scene.createEmbeddedDocuments("Note", [
    note(journal, ids.cathedral, cathedral.name, point, CATHEDRAL_ICON, "#ff5050"),
    ...locations.map(l => note(journal, l.id, l.result.name, DISTRICTS[l.district], LOCATION_ICON, "#ffffff"))
  ]);

  await game.macros.get(ADVENTURE.nightsClockMacro)?.execute();
  await scene.view();
  journal.sheet.render({ force: true });
  ui.notifications.info(t("Hunt.Notify.Started", { journal: journal.name }));
}

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

/**
 * The cathedrals as The Cathedrals page lists them: each <h2> and the elements up to the next.
 * Read from the world's copy of the GM journal so the text matches the imported language.
 */
function readCathedrals() {
  const content = game.journal.get(ADVENTURE.gmJournal)?.pages.get(ADVENTURE.cathedralsPage)?.text.content;
  if (!content) return [];
  const body = new DOMParser().parseFromString(content, "text/html").body;
  return [...body.querySelectorAll(":scope > h2")].map(h2 => {
    let html = "";
    for (let el = h2.nextElementSibling; el && (el.tagName !== "H2"); el = el.nextElementSibling) html += el.outerHTML;
    return { name: h2.textContent, html };
  });
}

/** A select whose options are a table's results, drawn by rolling that table. */
function tableField(name, label, table) {
  return { name, label, table, options: table.results.map(r => ({ value: r.id, label: r.name })) };
}

/**
 * A value for the field other than those in `exclude`: rolled on its table when it has one, so a
 * table's own formula and weights decide, otherwise picked evenly among its options.
 */
async function draw(field, exclude = []) {
  if (field.table) {
    for (let tries = 0; tries < 20; tries++) {
      const { results } = await field.table.roll();
      const id = results[0]?.id;
      if (id && !exclude.includes(id)) return id;
    }
  }
  const values = field.options.map(o => o.value);
  const pool = values.filter(v => !exclude.includes(v));
  const from = pool.length ? pool : values;
  return from[Math.floor(CONFIG.Dice.randomUniform() * from.length)];
}

/** A labelled <select> with a die button that draws it again. Labels come from documents, so they are escaped. */
function selectField({ name, label, options }, selected) {
  const opts = options.map(o => `<option value="${escapeHTML(o.value)}"${o.value === selected ? " selected" : ""}>`
    + `${escapeHTML(o.label)}</option>`).join("");
  return `<div class="form-group"><label>${escapeHTML(label)}</label><div class="form-fields">`
    + `<select name="${name}">${opts}</select>`
    + `<button type="button" class="icon fa-solid fa-dice-d6" data-reroll="${name}"`
    + ` data-tooltip="${escapeHTML(t("Hunt.Reroll"))}" aria-label="${escapeHTML(t("Hunt.Reroll"))}"></button>`
    + `</div></div>`;
}

function page(_id, name, content) {
  return { _id, name, type: "text", text: { content } };
}

function note(journal, pageId, text, { x, y }, icon, tint) {
  return {
    entryId: journal.id, pageId, x, y, text,
    texture: { src: icon, tint },
    iconSize: 80,
    fontSize: 48,
    flags: { [MODULE_ID]: { hunt: true } }
  };
}

/** A string from lang/, in the GM's language when the hunt starts. */
function t(key, data) {
  return game.i18n.localize(`BLOODSTONE.${key}`, data);
}
