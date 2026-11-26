# Pets: where to get them and licensing

t3-pet shows the built-in mascot by default. It can also show any pet in the Petdex/Codex format.

## Getting a pet

1. Install one with the Petdex CLI, or from a Codex pet folder you already have. Pets are looked up in `~/.petdex/pets` and `~/.codex/pets` (one folder per pet, with `pet.json` and a `spritesheet.webp` or `.png`).
2. Open the tray menu, then Pet, and choose it. The choice is remembered.

You can also point `T3PET_PET` at a folder name or a full folder path. See `AGENTS.md`.

## Licensing

- **This repo ships no community pets.** Petdex pets belong to their creators, who set their own terms. Nothing in this repo's MIT licence covers them.
- The built-in mascot (code in `src/shared/sprite.js`, `assets/mascot-reference.png`) comes from the upstream project and is covered by this repo's licence and the upstream credit in `LICENSE`.
- Check a pet's licence on its Petdex page before you redistribute it, put it in a video, or use it commercially. Using it privately on your own desktop is your own call.
- If you make your own pet, you choose its licence.

## For contributors

- Never commit third-party pet art. That includes spritesheets, `pet.json` files copied from Petdex, and screenshots or GIFs that show a community pet.
- `.gitignore` blocks `design/assets/`, `design/*.png`, `pets/`, and `spritesheet.webp`, `spritesheet.png`, `*-spritesheet.webp` and `*-spritesheet.png` anywhere in the repo. If you need a pet for a mock-up, keep it in `design/assets/`.
- Tests build their own stand-in pet files in a temporary folder and never read real pets.
- A pet you made yourself can be committed only if you wrote its licence next to it and the owner has agreed.

## The `fps` extension

`pet.json` may carry an optional `fps` field. It is a t3-pet extension, not part of the Petdex format. See `docs/animations.md`.
