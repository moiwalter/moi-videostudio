# Editing styles

A style is the editing language. The engine renders it; the client brand supplies identity; the episode supplies its story, source and decisions.

| Style | Use it for | Native reference | What carries forward |
|---|---|---|---|
| [Paper Collage](../styles/paper-collage/STYLE.md) | Storytelling with photographic paper cutouts, real documents, recognizable logos, real video and a visible speaker | Cvandersep2 A/B, Remotion | Authentic resources, meaningful motion, hook first, scene-by-scene review |
| [Layered Talking Head](../styles/layered-talking-head/STYLE.md) | Foreground speaker with motion and resources between subject and background | Cvander0910 v5, HyperFrames | Conditional segmentation, deliberate layer order and difficult-frame checks |
| [Moi Overlay](../styles/moi-overlay/STYLE.md) | The established Moi card/overlay workflow, often delivered as a CapCut KIT | Existing shared HTML/KIT projects | Its own typography/coverage/caption rules, scoped to that style |
| [Micro-podcast](../styles/micro-podcast/STYLE.md) | Host asks and guest answers in separate recordings, edited as one conversation | Cvander «Pregúntale a un humano» ep01/ep02, HyperFrames | Generated listener, per-speaker loudness, transition on every join, guest authority tag |
| [Investigación cinematográfica](../styles/investigacion-cinematica/STYLE.md) | Opinion video told as an investigation: anomaly → evidence → turn → open case | Cvander Jobs (published 23-oct), HyperFrames | Untouched audio order, source first, one accent color, three transitions, continuous score |
| [Moderno limpio](../styles/moderno-limpio/STYLE.md) | Resource-heavy talking head: cut-out speaker on dark plates, film/archive, real tweets | Cvander optimismo r4 (approved 31-oct), HyperFrames | Speaker always present, muted-readable resources, captured embeds, no overlap |
| [Hilo de chat](../styles/hilo-chat/STYLE.md) | Two-sided chat thread where each beat is a video message | Cvander Telegram × Maria la del Valley, HyperFrames | Data-driven episode, the second voice rules, explicit fiction |
| [Vlog de evento](../styles/vlog/STYLE.md) | Event recap: voice track over many takes of the same event + official/archive footage + real news pages with a TikTok swipe; one stretch may change tone | Cvander Cloudflare Connect (delivered 25-oct-2026), HyperFrames | The voice leads the cuts, real captures, facts verified before they go on screen |
| [QMD vertical](../styles/qmd-vertical/STYLE.md) | Short talking-head: the speaker stays large, a landscape panel the head breaks out of, light ground, both 1080×1920 and 1920×1080 | goldmine v3.3 (approved 1-nov-2026), HyperFrames | Plan approved first, PNG frames, grain under the face, logo+domain outro, one mix at −14 LUFS |

Most of these styles were born in client work; the contract keeps the method and leaves the client's identity behind. QMD vertical was measured on goldmine v3.3 and ships both orientations. Not promoted: the Cvander «ensayo documental» attempt (rejected r4/r5, replaced by Moderno limpio). Rules that apply to every style: [REGLAS.md](REGLAS.md); client rules: `biblioteca/clientes/<client>.json`.

## Layers and knobs (1-nov-2026)

Every video resolves five layers, most specific wins: **engine → style → brand → client → episode**.
`node tools/capas.mjs <project>` prints the resolved result and where each value came from.

| Layer | File | Owns |
|---|---|---|
| Style | `styles/<id>/style.json` | Method (principles, scene types) and its **knobs** with measured defaults |
| Brand | `biblioteca/marcas/<brand>.json` | Identity: palette, fonts, caption identity (`subtitulos`), `estiloPorDefecto`, framing per style (`encuadre`) |
| Client | `biblioteca/clientes/<client>.json` | Rules of one person (Chris: English stays English, «AI», guiño, vetoed clips), each with source and check type |
| Episode | project `pipeline.json` (`style`, `perillas`) + `master/BRIEF.json` | This video's direction and overrides |
| All videos | [REGLAS.md](REGLAS.md) | What the pipeline already learned |

**Knobs (`perillas`)** are optional in `style.json`; when present each one needs:

```json
"perillas": {
  "ritmoHook": {"que": "seconds until the first visual change", "default": 1.5, "rango": [0.5, 4], "medido": "<approved video where the default was measured>"},
  "acento":    {"que": "accent color source", "default": "marca", "opciones": ["marca", "neutro"], "medido": "…"}
}
```

Brand and client adjust them with `"perillas": {"<style-id>": {…}, "*": {…}}`; the episode with `"perillas": {…}` in
`pipeline.json`. A layer that sets a knob the style does not declare, or a value out of range, is an error. A default
without `medido` is rejected: knobs are measured on approved videos, never invented (`capas.test.mjs` enforces it).

“Paper edit”, “recortes de papel” and “like Cvandersep2” map to **Paper Collage**. “Paper clip” normally names the office fastener; use Paper Collage for the editing category.

Client palette/fonts/logos come from `brand.json`. Speaker treatment, exact hook, subtitle background, anglicisms, safe-zone choice, music and scene timing come from the current brief. Christian's AI terminology and purple are client/episode decisions, not universal template defaults.

The style contract works across engines. Paper Collage has a production reference in Remotion. A HyperFrames Paper Collage scene still needs a native style pilot; the generic contract does not claim that a complete component library has been ported. New Remotion scaffolds start empty and pending, with the selected client's brand.
