# Jungle King development constraints

The default `master` branch is the approved painted game. Real-time battle work
belongs to `feature/3d-battles`. Do not merge that branch into master, publish a
website, make the repository public, or deploy production without approval.

Use English project identifiers and `jungle-king` names, not romanized Chinese
project names. Retain Traditional Chinese UI text and the approved brush-written
破. Preserve third-party author identities, URLs, licenses, original model bytes,
and existing English local-save keys.

Keep rules and AI shared. A legal capture is authoritative; presentation must
complete exactly once after normal completion, skip or painted fallback. Replay
must not alter state. Do not replace approved animal artwork, motion, soundtrack,
or calligraphy as part of maintenance or naming changes.

Read README.md and run `python3 tools/check.py` before delivering a changed build.
Distinguish unit/static tests from actual browser rendering/physics tests. Do not
claim the latter passed unless they were actually run and their evidence exists.
The current 3D coverage is elephant attacking tiger only, for either army.

Do not commit generated dist/ files, installed dependencies, credentials, font
files, soundfont files, or new blanket license terms. Existing asset notices are
in CREDITS.txt and licenses/.
