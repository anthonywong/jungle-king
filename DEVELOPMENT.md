# Jungle King development

For playing the game, see [README.md](README.md). Read [AGENTS.md](AGENTS.md)
before making changes.

Approved painted-game baseline. This repository preserves two presentations of the same animal-chess
game, not two unrelated rule engines. Traditional Chinese game text is retained.

## Branches and checkpoints

- `master`: the painted/2.5D game, including the approved lion and elephant films,
  original background music, animal-call imitations and brush-written 破.
- `feature/3d-battles`: the same board and AI plus a Three.js/Rapier elephant-versus-tiger
  capture scene. Other pairings use the painted presentation.
- `2d-baseline` and `3d-elephant-preview`: initial recovery tags.

The 3D branch starts from the master checkpoint. These are import commits made
now from existing source packages, not a reconstruction of the historical edits.
The stable game is published to GitHub Pages. No blanket project license is enabled.

## GitHub Pages

Live game: https://anthonywong.github.io/jungle-king/

`.github/workflows/pages.yml` builds and deploys `master` after each push, or when
manually run from the Actions tab. It runs `python3 tools/check.py` before uploading
only the generated `dist/` distribution, including asset credits and licenses.
Generated files remain untracked. Deployment requires the repository's Pages
source to be set to **GitHub Actions**.

The deployment job has Pages and OIDC permissions; no personal access token is
needed. Only `master` can run this workflow, including manual runs. The experimental
3D branch is not published by it.

## Build and run

Python 3.10+ and Node.js 18+ are sufficient for the local build/check workflow.
There are no npm dependencies to install for the existing source packaging.

```sh
python3 build.py
python3 launch.py
```

The launcher serves `dist/` on loopback and opens a browser. Alternatively open
`dist/index.html` directly. On the 3D branch keep `index.html` and `battle.html`
together; the elephant model is included and requires no manual import.
Re-run the build after changing branches so that generated files match the branch.

The painted game has no runtime network dependency. The 3D scene still downloads
pinned Three.js 0.180.0 / GLTFLoader and Rapier 0.17.3 at runtime. Loading or contact
failure must fall back to painted presentation without cancelling a legal move.
For the 3D encounter choose 「試玩 3D 巨象捕獲」, then capture the tiger on D6 with
the elephant on D5. P pauses; Space or Esc skips. For a normal game use 「入局對弈」.
Those 3D-specific buttons are not present on master.

## Test

```sh
python3 tools/check.py
```

This runs the actual source rule/AI and timeline tests, namespace and asset checks,
and, on the 3D branch, capture-lifecycle tests using a synthetic interface. It also
checks generated JavaScript syntax, original model hashes and publishing safeguards.
It does **not** render a browser, execute live Rapier collisions or publish to GitHub.
Results are written under ignored `checks/`. Historical QA reports in `docs/` retain
the original test scope and are not evidence that every platform was retested now.

For actual 3D browser evidence run `python3 launch.py --check` on the 3D branch.
Inherited painted browser test scripts are under `game/tests/`; they require
Playwright/Chromium separately and are not part of the dependency-free checks.

## Editable files

- `game/src/`: game, rules, AI, renderer, audio and painted capture timelines.
- `game/assets/` and `game/audio/`: original editable media. Generated embedded
  JavaScript maps are retained so initial builds need no media-tool installation.
- `game/tools/`: embedding and optional artwork/audio preparation utilities.
- `scene/src/`, `scene/assets/`: 3D branch only; scene, adapter, original/optimized
  elephant model, supporting tiger and materials.
- `tests/`: runnable checks; `docs/`: provenance, preservation hashes and prior QA.
- `licenses/`, `CREDITS.txt`: retained third-party notices and asset provenance.

After editing raw painted media, regenerate maps before building:

```sh
python3 game/tools/embed_assets.py
python3 game/tools/embed_audio.py
python3 build.py
```

Regenerating the soundtrack is optional and needs the dependencies documented in
`game/tools/compose_audio.py`, including a locally available instrument bank.
No font or soundfont binary is included. Existing English localStorage keys are
unchanged to retain saved games/settings at the same browser origin.

## Names and content ownership

Use `Jungle King` for the English display name, `jungle-king` for file/package
prefixes, `jungle-king.capture.v1` for the internal host/scene channel, and
`capture-impact` for the 破 image alias. No romanized Chinese project names are
used. Chinese characters, font-family product names, creator identities and
third-party URLs are not translated or relabelled. Original model/media bytes
are preserved; source code that only required renaming is recorded in the audit.

No project-wide license has been chosen. Do not infer one from bundled third-party
licenses. Preserve all asset credits when packaging or publishing.

### Painted cutscene filenames

Use `<attacker>-vs-<defender>-<asset-type>-<id>.webp` for painted cutscene
artwork in `game/assets/`. Name the attacking animal first. Use lowercase words
and separate them with hyphens.

- For an individual drawing, use `frame` and its zero-based playback index,
  padded to at least two digits, as in `elephant-vs-tiger-frame-00.webp`
  and `lion-vs-leopard-frame-00.webp`.
- For a sprite sheet, use `sheet` and a stable name for its contents, as in
  `lion-vs-tiger-sheet-leap.webp`, `lion-vs-tiger-sheet-contact.webp`,
  `lion-vs-tiger-sheet-fall.webp`, or `lion-vs-tiger-sheet-key-poses.webp`.
  Keep that name when revising the artwork. Git records its revision history.

## Historical private-repository import helper

The original archive was prepared for a private `anthonywong/jungle-king`
repository with `master` as its default branch. The repository is now public;
the helper below remains available for the original private-import workflow and
will refuse the current public destination. It is not the Pages deployment command.

With GitHub CLI installed and authenticated as `anthonywong`:

```sh
gh auth login
python3 tools/publish.py --dry-run
python3 tools/publish.py
```

The helper verifies the account, creates a private repository when absent, pushes
only the two branches and two tags without force, sets master as the default,
and verifies remote hashes. It refuses a public destination or unrelated work.
It does not enable Pages, install deployment workflows, or change a live site.
It uses your CLI login locally; do not paste tokens into chat or commit them.

GitHub CLI command documentation:
https://cli.github.com/manual/gh_repo_create
https://cli.github.com/manual/gh_repo_edit

## Continued development

Keep master on the approved painted implementation. Develop and review 3D work
on its branch; bring shared rule/AI fixes across deliberately. Read `AGENTS.md`
before making changes. Do not treat an unrendered test count as artistic approval.
