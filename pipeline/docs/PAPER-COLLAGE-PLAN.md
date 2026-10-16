# Plan: reusable Paper Collage editing

> Implementation update19-sep-2026: see PIPELINE-OPERATIONS.md, EDITING_STYLES.md and PIPELINE-WORKFLOW.md for installed contracts and checks. This file retains the original plan; unchecked historical items are not the current status. Native visual/listening review and style-specific pilots remain explicit.

Date: 2026-09-19. Status: proposal; implementation has not started.

Walter confirmed that the delivered Cvander video captured the intended design and requested a reusable editing category for future footage and other clients. This document plans its integration into the existing video pipeline. It does not activate new tooling, migrate compositions, or change delivered videos.

## 1. Name and selection

Call the category **Paper Collage**, with internal ID `paper-collage`. Recognize “paper edit,” “recortes de papel,” and “como el de Cvandersep2” as aliases. A reference to “the other Christian video” is ambiguous: show the two references and establish which treatment the user means.

The initial editing catalog should distinguish:

| Style | Visual treatment | Proven reference |
|---|---|---|
| Paper Collage | Real photo cutouts, paper edges and shadows, documentary screenshots, real video windows, animated logos, and takeovers intercut with the speaker. | Cvandersep2, especially version B/r4. |
| Layered Talking Head | The original speaker is masked into the foreground so graphics and footage can pass behind them; base and subject layers stay synchronized. | Cvander0910 v3 and its existing layering guide. |

These are editing styles. `MASTER` and `KIT` remain delivery lanes; Remotion and HyperFrames remain engines. A scene may combine treatments if the current brief calls for it. Background removal is available where useful; Paper Collage does not require masking the speaker throughout the video.

## 2. What the current pipeline already provides

- [START_HERE.md](../../START_HERE.md): intake, brand loading, beat mapping, native preview, approval, and export workflow.
- [brands/INTAKE.md](../../biblioteca/marcas/INTAKE.md) and `brand.mjs`: reusable brand data and production briefs.
- `master/BRIEF.json` and `master/BEATS.json`: existing homes for project decisions and timed scenes.
- `approve-master.mjs`: scene approval tied to HTML/JS fragment hashes.
- [REVIEW.md](REVIEW.md) and `review-video.mjs`: preview/export evidence and input fingerprints.
- [SCENE_LIBRARY.md](SCENE_LIBRARY.md): scene-level archetypes, currently written around Moi. Keep these distinct from whole-video styles.

The delivered Paper Collage video uses **Remotion 4.0.525** for composition, animation, preview, and export. Its [asset record](../../proyectos/cvander/2026-09-cvandersep2-paper/edicion/ASSETS.md) also documents HyperFrames 0.8.44/U²-Net for photo segmentation. This is a useful combination of tools with one rendering engine per composition.

The shared tooling is not yet engine-neutral: `new-video.sh` scaffolds HyperFrames HTML, `flujo.mjs` detects MASTER through HTML, and preview/approval tools expect HTML/JS scene files. Brand checks inspect HTML; the review fingerprint traverses HTML/CSS references and requires explicit extra inputs for other dependencies. Remotion's React imports and dynamic media need equivalent coverage before these checks can claim support.

Two editorial conflicts also need resolution: START_HERE currently places asset selection after a placeholder preview, and `brands/cvander.json.videoWorkflow` carries the 0910 treatment. Neither should silently dictate every future Paper Collage project.

## 3. Separate reusable style from client and episode

Extend the existing brief with explicit selections rather than creating a second parallel brief system:

| Dimension | What belongs there |
|---|---|
| Style | Paper edges, cutout treatment, composition patterns, motion vocabulary, resource-selection criteria. |
| Client brand | Verified colors, fonts, logos, tone, terminology, and language preferences. |
| Episode | Source and transcript identity, hook, scene meanings, resources, camera presence, emphasis words, and exceptions. |
| Distribution | Aspect ratio, FPS, destination, organic/paid placement, editable safe-zone profile. |
| Engine and lane | Renderer, pinned version, entry point/composition ID, and MASTER/KIT. |

Current instructions take precedence over saved defaults. Resolve remaining settings from the episode, selected style, and client profile, with field ownership explicit. For example, the style requests contrasting caption surfaces; the client supplies the allowed colors; the episode selects the combination.

Purple `#3C0058`, Lineal/Rubik, “AI” instead of “IA,” and anglicism emphasis belong to Christian's profile or episode decisions. Dario, Claude, the letter, 19 scenes, the 4.9-second hook, exact enlargement percentages, and the 80% paper-frame scale are reference-video decisions, not universal defaults.

Replacing the source creates a new project with a fresh transcript and beat map. Reuse the editing vocabulary and components; timing, claims, resources, captions, and approvals must correspond to the new recording.

## 4. Permanent production loop

1. **Intake.** Read the supplied video and existing context. Resolve client, style, destination, and editing scope. Ask only for missing information; reuse answers already given. If style is unspecified, recommend one using short visual references. Keep an existing engine; use Remotion as the first proven implementation for new Paper Collage work unless the user chooses otherwise.
2. **Map.** Identify the actual spoken beats and propose a compact scene map: time range, spoken phrase, intended visual meaning, speaker treatment, resource needs, and motion. The user directs the map and can choose which scene to review next. Resolve transcript uncertainty before final captions rather than quietly copying gaps.
3. **Hook first.** Build the opening with real candidate assets, the actual speaker, brand colors, caption styling, and destination margins. Show motion in native Studio. Approve this visual direction before spreading it across the piece. Full-screen speaker is the strong Cvander B reference, but remains a project choice.
4. **One scene at a time.** For the selected scene: source resources → check them at final crop/size → build motion → inspect it → show the scene with voice in the full timeline → receive approval or feedback → record the reviewed revision. Continue to the next selected scene. Resource research for upcoming beats may continue; unapproved scene designs should not become a finished full edit by default.
5. **Continuity.** After scene approvals, review joins, rhythm, recurring components, speaker presence, caption consistency, and audio across the assembled piece. Preserve approved scenes unless a change affects them.
6. **Export.** On the user's render instruction, produce the requested delivery and verify the resulting file. Export authorization comes from the conversation; do not ask for the same permission again. Keep one explicit current-export pointer per variant and preserve previous deliverables.

Editorial approval is the user's decision. Technical review is the agent's responsibility. A successful check cannot approve a scene on the user's behalf. Broader user authorization can change the review sequence; record its scope rather than manufacturing approval records.

## 5. Resource selection and motion rules

The agent owns resource discovery. User-provided sources and available stock-library access, including Envato, are inputs to that work. Do not make the user search by default. If an asset requires unavailable account access, request the specific file or offer a suitable accessible candidate; never assume access or a license.

For each scene, show a recommended resource in its intended crop. Offer a second candidate only where a meaningful choice or uncertainty exists. Use real photos, authentic documents/screenshots, official logos, and actual footage. Preserve their identity inside the paper treatment. Record source URL, author/provider, publication date, capture/event date if known, archive status, usage/license information where available, local path, relevant clip interval, and scenes using it.

Recheck factual relevance and recency for each new episode. A recently published page does not make its image recent. User-selected archive material remains identified as archive; do not inherit it as a fresh source for another client. Preserve original pixels and source copies when preparing cutouts and crops.

Lessons to encode in the style guide:

| Failure from this production | Reusable rule |
|---|---|
| Cables used to represent data centers | Show the named subject recognizably at phone size; a related object is not always a useful illustration. |
| Chips or electricity unclear | Choose a visible physical processor or meaningful power-infrastructure shot; verify the final crop before animation. |
| Cutouts enter and then do nothing | Give the scene an action that advances its meaning: reveal, compare, exchange, collide, accumulate, or change focus. Motion need not be constant. |
| China or “war” conveyed only by a label | Express the narrated relationship through movement and composition. Keep claims faithful to the speech; a logo transformation must not introduce an unsupported factual claim. |
| Jensen duplicated unintentionally | Check subject identity and visual repetition across foreground and supporting footage. |
| All-In covered Trump | Declare and inspect foreground/background order in motion. |
| Captions merged with the background | Choose contrast roles before building scenes; check over both footage and paper. |
| Safe-zone work arrived late | Include destination guides in the hook and first scene; adapt to the actual framing, with mobile-app validation kept distinct from an editorial simulation. |

Initial reusable scene patterns: speaker-led hook with evidence; portrait plus product logo; document reveal; real B-roll inside a paper frame; infrastructure detail; model/logo relay; collision/comparison; speaker inside collage; speaker-led close. Extract parameters and motion phases, not episode-specific names or timestamps. Keep the existing no-quota approach to takeovers.

## 6. Documentation and integration deliverables

All new paths below are proposed, not installed capabilities.

| Deliverable | Integration |
|---|---|
| `EDITING_STYLES.md` | Small catalog with visual references, aliases, selection criteria, and actual engine-support status. Link it from START_HERE. |
| `styles/paper-collage/STYLE.md` and `style.json` | Human guide plus versioned defaults consumed by the brief. Cover resources, layouts, motion, speaker presence, captions, and review. |
| `styles/layered-talking-head/STYLE.md` | Generalize the existing layering method and link the 0910 guide for client-specific detail. Avoid duplicating the technical history. |
| Paper Collage reference sheet | Link a few frames/motion intervals from final B/r4 and identify the reusable pattern versus the episode choice. Keep media in video-edit, not the vault. |
| START_HERE, REVIEW, SCENE_LIBRARY, ORCHESTRATION | Route by style and engine; clarify real-asset previews, scene approval in the complete timeline, and proportional checks. Preserve KIT-specific contracts. |
| Brand brief/profile | Retain Christian's palette and voice preferences; select layering or paper through the style field rather than forcing 0910 through the brand. Maintain legacy behavior for older projects. |
| Existing tools | Extend `new-video`, `brief`, `flujo`, map/build/preview/approval, brand checking, and review with the necessary engine handling. Reuse their responsibilities; keep shared utilities in `tools/`. |
| Project state | Keep current source, selected variant, final export, remaining issues, and approval evidence in one current record; make README/brief/context summaries refer to it. The old B brief still says preview-only although B was exported; reconcile this during integration. |

For engine support, share the brief, timed scene contract, resource inventory, and approval/review semantics. Let each adapter implement native preview, composition, rendering, and relevant technical checks. Retain the existing beat-map location or declare its location explicitly; do not infer the engine from a folder name or maintain two handwritten timelines.

Scene approval fingerprints should cover the reviewed timing/text, scene code, selected media, and relevant shared styling/layout dependencies. A scene-specific edit invalidates that scene; a shared caption or palette change affects its dependents. Global export review becomes stale when any rendered input changes. Preserve the distinction between a planned resource and an approved scene containing the actual asset.

## 7. Implementation order and completion criteria

1. **Document and register.** Create the catalog, style guides, reference sheet, and routing links. Resolve the two editorial conflicts above. Finish when a fresh session can locate both styles and distinguish their client/episode choices.
2. **Make Remotion reuse concrete.** Extract the minimum reusable Paper Collage components from the delivered source into a shared template; connect selected brand/style and scene data through the existing tools. Keep delivered A/B unchanged. Finish when a new project can preview and review a scene without manually copying Christian's script or branding.
3. **Validate reuse.** On an isolated short pilot using a different existing brand and authorized footage, build a hook and one interior scene. Check that no Christian-specific terms, colors, logos, or timings leak; scene approval can be recorded; a targeted asset change invalidates the correct scene; native playback works; and export review covers the real React/media inputs. Run focused tests for these tooling changes and preserve existing HyperFrames/KIT behavior.
4. **Verify HyperFrames coverage when needed.** The shared style is engine-independent, but do not label a HyperFrames Paper Collage implementation as verified until a representative scene passes native playback and export checks. Add its adapter/template when a project needs it rather than porting the finished video or maintaining two complete component libraries upfront.

The first implementation should prioritize discoverability, the resource/hook loop, and Remotion reuse. Documentation alone does not make the current HTML-oriented tools compatible with React.

## 8. Cost and iteration discipline

- Ask for the source, client, destination, and any mandatory references once. Everything else comes from saved context or the current scene discussion.
- Review a real opening before building the whole video; use it to settle palette, caption contrast, paper treatment, and movement.
- Reuse approved assets and decisions within the episode. Reopen a search only when relevance, quality, freshness, or feedback requires it.
- For a small correction, inspect the changed interval and its transitions first. Expand review only for changed shared dependencies, failures, or unresolved concerns. Do not repeat the 338-moment layout audit for every adjustment.
- Iterate in native Studio and render the final deliverable when requested. Each actual export still gets file integrity and audio checks. Measure audio offset before correcting it; the observed 2048-sample AAC delay is a case finding, not a universal adjustment.
- Keep concise state and timestamped feedback. Measure revision count by cause—resource, hook, brand, motion, technical—and time spent, so the next production can demonstrate improvement without promising a fixed number of rounds.

Example future request: “Bro, edit this video as Paper Collage for client X, organic Reel.” The pipeline should resolve the brand and engine, map the new recording, prepare the real hook, and continue through the chosen scenes under the user's direction.
