# Pipeline operations

Run from `/Users/TERABYTE10/Movies/VideoStudio/`. Projects live in `proyectos/<client>/<slug>/edicion/`; `tools/` is a compatibility shortcut to `pipeline/tools/`. A project argument is an exact slug, a unique partial name, or an absolute directory. Ambiguous names fail. Status and `--check`/`--verify` are read-only. Preview starts a native server; scaffold, binding, approval, state changes, rendering and delivery recording write files.

## First: move newly supplied files into the project

When the user supplies a local file for a video, the agent must move it into that video's folder **without asking for confirmation**, verify it and immediately report the exact new path. Recordings belong in `proyectos/<client>/<video>/originales/`; clearly identified supporting assets belong in `recursos/`. Create the project folder first when necessary. Do not wait for engine, style, hook or scene decisions before organizing the file. Resolve missing identity through a clearly labeled provisional project, as described in [the intake procedure](ENTRADA-DE-ARCHIVOS.md).

Record the location in `PROYECTO.json`, preserve existing files on name collisions, and use the centralized path for subsequent work. An already centralized file stays in place. This is an agent action at intake; read-only status commands do not move files. Binding the exact edited cut with `source-state.mjs` remains a later, separate operation.

## Resume an existing video

```bash
node tools/flujo.mjs 2026-09-cvandersep2-paper --rapido --json
node tools/project.mjs show 2026-09-cvandersep2-paper
node tools/preview-video.mjs 2026-09-cvandersep2-paper --print
```

Read the latest request and current brief after the status. `pipeline.json` owns engine/version/entry, active variant, style, source/transcript identity, destination, review path, current export and next action. The two Cvander projects are registered historical deliveries: status checks their output hash and existing QA evidence without rebuilding or declaring new approval.

For legacy projects without `pipeline.json`, compare dated decisions across direction and scene-map files before proposing work. A valid old map is not scene approval; an older pause note does not erase a newer recorded concept decision. Record the reconciled state in a short CONTEXT and register explicit engine/source/review metadata when resuming production. Never infer a new approval or restart a closed cut to resolve inconsistent notes.

Exit codes for the router: **0** applicable reported checks pass or an explicitly registered historical delivery is intact; **1** failure; **2** pending/unverifiable or outside the supported route. Fast mode reports omitted checks. Aggregate output preserves failures; old projects with open issues are not silently repaired by a pipeline audit.

```bash
node tools/workflow-state.mjs <project> select --variant B
node tools/workflow-state.mjs <project> reopen --task "existing authorized correction"
```

Selecting is not reopening. Reopening preserves previous exports and records the task. Historical project-specific review formats are not silently re-signed: for the first new revision, author the shared scene map and a new schema-1 review receipt from actual new review work; keep original evidence intact. Bind the actual source/transcript for the revision. Do not ask the user to repeat previous decisions.

## Start a new video

```bash
tools/new-video.sh <new-slug> --marca <brand> --carril master --engine remotion --style paper-collage
tools/new-video.sh <new-slug> --marca <brand> --carril master --engine hyperframes --style layered-talking-head
tools/new-video.sh <new-slug> --marca moi --carril kit --engine hyperframes --style moi-overlay
node tools/brand.mjs brief <brand> <style>
```

Resolve existing brand, style, source, direction and platform from the request before asking anything. Scaffolds are empty, not completed videos; install their dependencies when needed. Remotion scaffold currently supports MASTER. Existing registered projects can declare KIT+MASTER with both native deliverables. No automatic engine migration.

If intake already created the project folder, `new-video.sh` accepts it only when `PROYECTO.json` declares `state: "intake-pending"`, its client/slug match and `edicion/` is empty. Both engines preserve existing media/provenance and register the initialized project in the catalog. Existing editor content always blocks reinitialization.

Required working fields in `pipeline.json`: `schemaVersion: 1`, `lane`, `brand`, `style`, `engine: {name, version, entry, composition}`, `source`, `transcript`, `distribution: {width, height, fps, frames, placement}`, `paths: {master, map}`, `review`, and `nextAction`. MASTER scene entries in `BEATS.json` use project-relative `entry` paths, including `.tsx`. Variant overrides can declare engine/composition, props, paths, review, state and export.

For original speech:

```bash
node tools/source-state.mjs <project> --bind --source public/source.mp4 --transcript local/transcript.json --language es
```

Before the map, clean the speech: `python3 tools/limpiar-habla.py --audio <take> --words <aligned words>` lists filler sounds, long pauses and retakes that a transcript does not show. Cut, re-align, then record the receipt with `node tools/source-state.mjs <project> --limpieza local/limpieza.json --decision "…"`. A spoken cut bound from 5 Oct 2026 stays PENDING without it. Details: [SEGMENTAR-POR-IDEAS.md](SEGMENTAR-POR-IDEAS.md), step 0.

Bind the exact edited cut used as the timeline clock. Record unresolved speech spans in `transcript.unresolved`; do not substitute invented words. Hash matching verifies identity, not transcription accuracy. A graphics-only source can use `transcript.notApplicable` with a real reason. Music and SFX are optional; `audio.mode: "silent"` explicitly declares an output without audio. Set technical targets only when specified.

Source checks and binding follow the active variant. Binding real speech removes a previous `notApplicable` exemption and preserves unresolved spans for actual listening. Other variants and the base cut keep their own records.

## Work scene by scene

1. Map what the scene needs to communicate; select actual resources with provenance and the intended crop. Resolve dubious photos before animating them.
2. Build the actual hook first. Use the selected client's brand, then the episode's speaker, captions and platform treatment.
3. Open `node tools/preview-video.mjs <project>` for the complete native timeline. Seek/play the selected scene and its joins with voice. KIT can use `tools/preview.sh <project> S01` for the active overlay.
4. Inspect actual motion, resource readability, layer order, captions and speaker. Show the concrete scene and record the user's actual decision.

```bash
node tools/approve-master.mjs <project> S01 --decision "actual user decision or conversation reference"
tools/approve.sh <project> S01 --decision "actual user decision or conversation reference"
node tools/approve-master.mjs <project> --check
```

A boolean/date is not enough for a new approval. The recorded decision binds current scene inputs, media, imports, timing and shared dependencies. Local edits do not invalidate unrelated scenes; dynamic asset construction can conservatively cover the public tree. Use local relative imports; unresolved aliases/dynamic imports return unverifiable. Freeze render dependencies locally. `extraInputs` can include explicitly loaded assets/configuration that are outside a statically visible dependency graph.

`build-master.mjs --verify` and `build-kit.mjs --verify` check their supported HTML fragments without emitting composition/build logs. They do not prove full output readiness. Write scenes locally; optional `--delegate` is reserved for explicitly requested delegation. The old `map-beats --emitir` and `subtitulos.mjs` helpers are scoped to compatible HTML workflows; they do not modify a Remotion composition.

## Review, render and delivery

Initialize a schema-1 review receipt if the new revision lacks one. The CLI follows the active variant’s `review` path; `--receipt review/new-revision.json` explicitly selects another file. Update the variant’s `review` pointer when adopting it, and preserve the old receipt. Set its composition to the registered entry, then record the inspection actually performed. The JSON is evidence, not automatic visual QA or user approval.

```bash
node tools/review-video.mjs <project> --init --composition src/index.ts
node tools/review-video.mjs <project> --fingerprint
node tools/review-video.mjs <project> --check --stage preview
node tools/preflight.mjs <project> --stage render
node tools/render-video.mjs <project> --output ../entregas/revision-name.mp4 --authorization "existing render request"
```

Use the existing authorization; do not ask again. The MASTER wrapper refuses to overwrite an existing file, renders the recorded engine/composition/props, records its command and checks actual format, complete decode and audio. It leaves visual and synchronization review pending. Preview approval cannot sign the exported image or audio automatically.

For KIT:

```bash
tools/lock-all.sh <project> --lista
tools/alpha.sh <project> S01
tools/final.sh <project> S02
tools/lock-all.sh <project>
node tools/validate-kit.mjs <project> --final --tabla
```

Alpha/final wrappers block on missing/stale approval or preflight failure. Alpha clips require real premultiplication and numeric post-checks; inspect composition over the intended footage. Output receipts bind rendered bytes to approved inputs. BOTH requires both lanes, not one successful branch. Raw engine CLIs remain diagnostic/native tools; they cannot establish shared final-delivery status by themselves.

Review actual final MP4/KIT images, transitions and voice sync; record notes/evidence and actual output SHA256 in the export review receipt. The technical helpers do not validate resource meaning, transcription, intelligibility or editorial quality.

```bash
node tools/loudness.mjs <actual-file>
node tools/qc-sonido.mjs <actual-file>
node tools/verify-export.mjs <actual-file>
node tools/preflight.mjs <project> --stage delivery
node tools/flujo.mjs <project> --entregado
```

`--entregado` requires actual output checks and all applicable current approvals; it records a delivery manifest. Keep project CONTEXT short and point to the canonical variant. Delivery does not imply publishing or a new client approval. For Instagram, inspect the actual draft in the chosen placement before publication; a geometric safe-zone check does not reproduce all app UI conditions.

## Scope of proof

Regression tests: `node --test tools/review-video.test.mjs tools/pipeline.test.mjs tools/workspace.test.mjs`. [Latest readiness review](PIPELINE-READINESS-2026-09-20.md): 44 tests passed, including six isolated fresh/intake scaffold combinations. Evidence is in `../../archivo/auditoria-pipeline/2026-09-20-readiness/`. The earlier isolated Remotion fixture exercises another brand, native Studio, approved-test preflight and a Full HD output. It is explicitly synthetic and does not claim a new full client edit or a ported HyperFrames Paper Collage component library. Original Cvander exports are checked for byte identity.
