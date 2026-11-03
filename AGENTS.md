# Workspace location — 20 September 2026

Canonical workspace: `/Users/TERABYTE10/Movies/VideoStudio/`. All personal and client videos outside Stacksync belong here. Stacksync stays in its own repo and is excluded.
Read `catalogo.json` and `proyectos/<client>/<video>/PROYECTO.json`; the editable is `edicion/`. Read `pipeline/docs/PIPELINE-OPERATIONS.md` for the workflow. Shared brands/resources are in `biblioteca/`; tools, styles and templates are in `pipeline/`.
Use `node pipeline/tools/flujo.mjs <exact-slug> --rapido --json` to resume. Slugs shared by different clients require `<client>/<slug>`. New projects must be created with `pipeline/tools/new-video.sh`; it creates the nested client layout. Old Downloads paths and `.compat/` are compatibility aliases, never new project destinations.

# Shared video pipeline

Mandatory first action for a user-supplied local video input: move it into the selected project's `originales/` (clearly identified supporting assets into `recursos/`), verify the move and immediately tell the user the exact new path. This routine move is already authorized: do not ask permission. Create the project folder first if needed; do not wait for engine/style/hook approval. If identity is unresolved, use a clearly labeled provisional project under `proyectos/por-clasificar/`, then resolve the missing details. Preserve names without overwriting collisions; record the new location in PROYECTO.json and use it for subsequent work. Follow [the intake procedure](pipeline/docs/ENTRADA-DE-ARCHIVOS.md), including explicit user overrides and reporting actual filesystem failures.

Start with START_HERE.md, pipeline/docs/REGLAS.md (editing rules for every brand), biblioteca/clientes/<client>.json (rules of that person, if it exists) and the selected project's pipeline.json, current brief/CONTEXT and latest user request. Use `node tools/flujo.mjs <exact-project> --rapido --json` to locate the current engine, variant and next action. Quick mode is not final QA.

For legacy projects without pipeline.json, reconcile dated decisions in direction, brief and scene map. A newer recorded concept choice can supersede an older pause note, but it never proves that scenes were approved. Keep one short current CONTEXT, preserve historical evidence, and register explicit source/engine/review state when production resumes. Treat unmapped, missing or unapproved scenes as pending work.

Preserve the existing engine and pinned version. Remotion projects stay in Remotion; using HyperFrames for segmentation does not migrate the renderer. Do not reopen or regenerate a historical delivery unless the user requests a change. Small corrections skip new-project intake.

For a fresh video, separate client brand, editing style, episode direction and platform. Paper Collage is an installed style; read EDITING_STYLES.md and styles/paper-collage/STYLE.md. Use authentic local resources with provenance. Review actual candidates and crops before investing in animation. Do not copy another client's colors, words, timings or framing.

Default creative loop: build the actual hook, show it in the native composition with voice, record the user's decision; then work scene by scene. Existing decisions and render authorization persist. Never manufacture an approval from a passed technical check. Continue already authorized research, implementation, repair and QA without requesting permission again.

Status/check/verify are read-only. The native preview and final commands are in PIPELINE-OPERATIONS.md. Preflight must pass before a final render; verify actual output before declaring delivery. Review receipts record work actually inspected and never replace that inspection. Caption/safe-zone/voice synchronization and resource relevance require contextual visual or listening review.

For corrections, inspect the changed scene and joins first. Shared changes invalidate dependent scenes; a new source/cut invalidates transcript/timing work. Preserve prior exports and record current variant, latest feedback, evidence and nextAction in pipeline.json. Keep CONTEXT brief and point to the record; retain detailed history separately.

Do not invoke optional builder delegation unless the user explicitly requests delegation. Do not stage unrelated changes or commit automatically.
