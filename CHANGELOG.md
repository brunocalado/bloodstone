# Unreleased
- [Changed] The GM journal and the README explain the Start the Hunt macro and the non-player character actors; the Player journal no longer mentions the removed dice macros.
- [Added] An actor for each Apostle, danger and weird character in the GM tables, with a blank sheet for the GM to fill and a token to place; the Start the Hunt pages link to them.
- [Added] A Start the Hunt macro (`bloodstone.startHunt()`): draws (one by one or all at once) or lets the GM pick the secret cathedral, the Apostle, three locations, the opening obstacle and a weird character, starts the Night's Clock, and writes a GM-only journal pinned to the Map of Heliwyr as notes.
- [Added] A Brazilian Portuguese (pt-BR) Bloodstone Adventure compendium.
- [Added] Brazilian Portuguese (pt-BR) for the roll windows and chat cards.
- [Added] A Bloodstone Rolls macro (`bloodstone.rollMenu()`): one window with a button for each roll, for the hotbar.
- [Removed] The 0d to 9d dice macros; the sheet's Roll and Use buttons and the Resist macro cover every roll.
- [Changed] The module's code is now licensed under GPL v3 (was MIT).
- [Changed] Releases are built by a GitHub workflow from JSON sources; install and update through the GitHub release manifest.
- [Breaking][Changed] Bloodstone now runs on the Text-Based Actors (TAF) system 3.3.0 and Foundry v14; Simple Worldbuilding is no longer supported.
- [Breaking][Removed] The Forged in the Dark Roller dependency.
- [Breaking][Changed] Global Progress Clocks is now required.
- [Added] Action Roll, Resist and Firearm rolls with the v1.4 result tables, available to macros as `bloodstone.actionRoll()`, `bloodstone.resist()` and `bloodstone.firearm()`.
- [Added] A TAF Hunter with the v1.4 tracks (5 Blood, 3 Stamina, 4 Insight, 6 Silver Bullets), roll buttons on Prowess, Resolve and Wit, and Use buttons on each trick weapon and firearm.
- [Changed] Player journal rewritten for game version 1.4, with an Action Roll page.
- [Added] The Heliwyr map as a scene, with the cathedrals' special rules in the GM journal.
- [Changed] GM journal rewritten for game version 1.4.
- [Breaking][Changed] Clock macros use Global Progress Clocks instead of Challenge Tracker.

# 0.1.0
v12

# 0.0.9
- macro update 

# 0.0.8
- v11 only

# 0.0.7
- permission fix
- trick weapon macro
- wounds fix

# 0.0.6
- macros style fix

# 0.0.4
- macro: firearm actions
- macro resist
- journal for player

# 0.0.3
- clocks for chalenge tracker
- sound oath in portuguese
- read me updated

# 0.0.2
first