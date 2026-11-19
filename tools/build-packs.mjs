/*!
 * Bloodstone - Action-Horror mini Forged in the Dark
 * 2022 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Compiles or extracts the compendium packs declared in module.json with the Foundry VTT CLI.
 *
 *   npm run pack     # packs/_source/<name>/**.json -> LevelDB at each pack's `path`
 *   npm run unpack   # LevelDB at each pack's `path` -> packs/_source/<name>/**.json
 *
 * Only the JSON source is committed: Foundry rewrites a LevelDB whenever a world that uses it
 * opens, so a committed one dirtied the tree with nothing edited, diffed as binary and could not
 * be merged between branches. The LevelDB packs are build output: the release workflow
 * compiles them, and locally Foundry reads and writes them. After editing a compendium in
 * Foundry, close the world (LevelDB opens in one process at a time) and run `unpack` before
 * committing; after pulling, run `pack`.
 *
 * The content ships as one Adventure, not as a pack per document type: the import lands every
 * document in the world with its ids, so world-relative links (`@UUID[Item.<id>]`) and the
 * attributes' `trigger` macros (`Macro.<id>`) keep resolving, and players import in one step.
 *
 * The Adventure is stored expanded: one file per embedded document, in folders by document type,
 * so a content edit is a one-file diff instead of a change inside one huge Adventure document.
 * Only `_Adventure.json` carries a `_key`; it lists every embedded file by relative path, and
 * `recursive` is what lets the compiler find it in its subfolder.
 *
 * `bloodstone-pt-br` is the same Adventure translated, and every embedded document keeps the id
 * of its English twin; only the Adventure itself has its own. Links and triggers then need no
 * rewriting, and importing one language over the other updates the same documents in place
 * (core asks before overwriting) instead of adding a second Hunter, macro set and directory.
 * New ids would let both languages live in one world, at the cost of rewriting every link and
 * trigger for a table nobody plays in two languages. A Babele overlay on the English pack would
 * keep one source, but adds a dependency whose handling of an expanded Adventure was never
 * confirmed. An edit to one pack's ids, links or non-text fields belongs in the other too.
 *
 * TAF matches an item group to the Hunter's `system.carryCapacity` by `toID(group)`, which
 * lowercases, turns spaces into `_` and strips `\W` — accented letters included. A translated
 * group needs its capacity key spelled that way ("Memória" -> `memria`), or the sheet shows a
 * capacity bar with NaN.
 *
 * Both directions start from an empty destination, so a document deleted on one side does not
 * linger on the other.
 *
 * A Scene file keeps `_stats.coreVersion`. Without it the server treats the scene as older than
 * 14.353 and its levels migration replaces `levels` with one rebuilt from the pre-v14 top-level
 * background fields, so the background image is lost on import.
 */

import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";
import { readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = join(ROOT, "packs", "_source");

const mode = process.argv[2];
if (!["pack", "unpack"].includes(mode)) {
    console.error("Usage: node tools/build-packs.mjs <pack|unpack>");
    process.exit(1);
}

const { packs } = JSON.parse(readFileSync(join(ROOT, "module.json"), "utf8"));

for (const { name, path } of packs) {
    const source = join(SOURCE_ROOT, name);
    const compiled = join(ROOT, path);
    if (mode === "pack") {
        rmSync(compiled, { recursive: true, force: true });
        await compilePack(source, compiled, { recursive: true, log: true });
    } else {
        await extractPack(compiled, source, {
            clean: true, folders: true, expandAdventures: true, omitVolatile: true, log: true
        });
    }
}

console.log(`\n${mode} complete: ${packs.length} pack(s).`);
