# CUTS — walter-raw.mov → master/cut.mp4

Draft for Walter's review. First cut Sun Nov 1 2026 about 3 AM PT; **re-cut about 3:30 AM PT** after Walter approved the scene plan and asked for "highly regulated" straight (C05). The cut itself is still a draft for his review in Studio.

- **Source:** the raw talking-head file (34.965 s, HEVC 60 fps, AAC 48 kHz stereo). The file is stored as 1920x1080 with a **-90° display matrix**, so it displays as **1080x1920 vertical**. ffmpeg autorotate was applied and the master is upright.
- **Master:** `master/cut.mp4`, **23.467 s**, 1080x1920, 60 fps (1408 frames), H.264 CRF 17, AAC 192k. Audio and video are both exactly 23.467 s, so there is no drift. (v1 was 24.800 s; C05 grew from 0.55 s to 1.89 s.)
- **Finished voice for the edit:** `master/assets/media/voice.wav` (`tools/audio.sh`): highpass 70 Hz, light FFT denoise (afftdn nr 8), a peak limiter, then two-pass **linear** loudnorm → **-13.8 LUFS integrated, -1.6 dBTP true peak**, LRA 3.7. No time-domain processing: length 23.467 s, identical to the picture.
- **Removed:** **11.497 s in 12 cuts** (34.965 → 23.467 s).
  - 1 false start: 1.39 s.
  - 1 rephrase, approved by Walter: "regulated, or" removed (C05, 1.89 s with the hesitation before it).
  - 1 mid-phrase hesitation, shortened to 0.18 s.
  - 7 dead pauses, shortened to 0.32 s at sentence ends and 0.25 s at commas.
  - Dead lead-in and tail.
- **No fillers found.** faster-whisper medium.en (prompted to keep disfluencies), vosk and a 10 ms energy map found no um, uh, eh, "like" or "you know".
- **No full retakes.** Every sentence was said once. The only re-attempt is the false start "and use— and have" (C07).
- **Method:** every kept span plays at 1x. Nothing is stretched, slowed or padded; only spans are removed.
  - Cut edges are on the 60 fps frame grid.
  - Joins sit in measured silence. The one exception is C07, which joins at the energy dip after "workflows" (-41 dBFS) onto the silence before the restart.
  - Each join has a 20 ms equal-power audio crossfade centred on it.
  - Tool: `tools/cut_master.py` reads `cuts.json` and writes `master/keep.json`, the source↔master clock map.
- **Verification:** I re-transcribed the master with faster-whisper medium.en (`master/cut.words.json`). It reads cleanly:
  > This is how you make a million dollars in one month. You get your private data and you sell to an AI frontier lab. This only applies for industries that are highly regulated or companies that have specific workflows and have some depth in their specific data. So, support tickets, customer conversations, because AI labs needs to understand this end-to-end interaction with customers. So you're sitting in a goldmine.

  The full-file pass drops "your" in "with your customers"; medium.en on a 2.7 s excerpt of the master AND of the source both hear "with your customers", so it is in the audio and was inserted on the energy map. Word timings: `tools/refine_words.py` snaps every whisper boundary that falls in silence to the -40 dBFS energy map (plus hand fixes read off the energy map: four where whisper collapsed "So, support" into 0.04 s spans, and seven where a word span swallowed a pause: dollars/in/one, data/and, regulated/or/companies, understand/this. "or" is after the 10.617 join, not before it) → `master/cut.words.json` (asr format) and `master/words.json` (caption-kit format).

  New master joins: 3.033 · 4.600 · 6.317 · 9.583 · 10.617 · 12.417 · 14.500 · 17.017 · 18.850 · 21.600. Level at each join (±10 ms RMS): -48, -44, -47, **-39 (C05, onto the "h" of "highly")**, -49, -41 (C07), -49, -49, -48, -48 dBFS.

## Cut list (source seconds on walter-raw.mov)

| id | source | removed | type | reason |
|---|---|---|---|---|
| C01 | 0.00–1.48 | 1.48 s | dead lead-in | silence before the first word; keep 0.10 s of room before "This" (speech onset 1.58) |
| C02 | 4.51–5.74 | 1.23 s | dead pause | 1.55 s pause after "…in one month." (4.33→5.88), kept 0.32 s |
| C03 | 7.30–7.86 | 0.56 s | dead pause | 0.81 s pause in "your private data, | and you sell" (7.16→7.97), kept 0.25 s |
| C04 | 9.58–10.45 | 0.87 s | dead pause | 1.19 s pause after "…AI frontier lab." (9.40→10.59), kept 0.32 s |
| C05 | 13.72–15.60 | 1.88 s | rephrase (approved) | **Walter, Nov 1: straight to "highly regulated".** Removes the hesitation + "regulated, or": "industries that are \| highly regulated". Keeps 0.18 s after "are" (ends 13.53); joins at the dip after "or" (15.58–15.66, ≈-35 dB) onto the onset of "highly" (15.68). Re-transcribed clean. (v1: 13.63–14.18, hesitation only) |
| C06 | 16.64–16.98 | 0.34 s | dead pause | 0.59 s pause in "highly regulated, | or companies" (16.50→17.09), kept 0.25 s |
| C07 | 18.78–20.17 | 1.39 s | false start | "…specific workflows and use— | and have some depth": cut the abandoned "and use" + its 0.43 s pause; join at the energy dip after "workflows" (-41 dB) onto the silence before the restart |
| C08 | 22.25–22.80 | 0.55 s | dead pause | 0.84 s pause after "…their specific data." (22.11→22.95), kept 0.32 s (with the onset before "so") |
| C09 | 25.31–25.89 | 0.58 s | dead pause | 0.83 s pause in "customer conversations, | because" (25.17→26.00), kept 0.25 s |
| C10 | 27.72–28.38 | 0.66 s | hesitation | 0.84 s hesitation in "needs to understand… this end-to-end" (27.62→28.46), kept 0.18 s |
| C11 | 31.14–32.47 | 1.33 s | dead pause | 1.65 s pause after "…with your customers." (30.96→32.61), kept 0.32 s |
| C12 | 34.33–34.97 | 0.64 s | dead tail | silence after the last word "goldmine" (ends 33.88); keep 0.45 s for the end card |

## Kept on purpose, flag for Walter
- ~~"regulated, or highly regulated"~~ → **cut to "highly regulated"** per Walter (C05 above).
- **"AI labs needs to understand"**: grammar slip kept, per Walter ("it's okay").
- **Jump cuts:** the video jumps at every join because he moves between takes. The edit plan hides each join with a zoom-scale change (see `ESCENAS.md`).

## v2 (Nov 1, 2026, ~10:30 AM PT) — C12 only
Same 11 cuts C01–C11 as v1. **C12 moved: 34.33 → 34.933 s** (Walter's default: +0.6 s of tail so the QMD wordmark holds about 1 s).
- Removed now: 0.032 s of tail (was 0.64 s). Room tone in the kept tail: -48..-51 dBFS; Walter stays still, no movement.
- v2 master: **24.067 s** (v1 23.467 s). Joins unchanged: 3.033 · 4.600 · 6.317 · 9.583 · 10.617 · 12.417 · 14.500 · 17.017 · 18.850 · 21.600.
- Voice re-made with the same chain (`tools/audio.sh`): -13.8 LUFS, -1.7 dBTP, length = picture.
- `master/words.json` is the v1 word timing (the change is after the last word, so nothing moved).

## v3 (Nov 1, 2026, PT) — cut unchanged, new matte
- Same 12 cuts and joins as v2; master 24.067 s; voice file unchanged (-13.8 LUFS, -1.7 dBTP).
- **Cut-out re-made**: Robust Video Matting (resnet50 ONNX) with its recurrent state (temporal smoothing), plus despill and the model's own foreground colour at the edge → `master/assets/media/walter-alpha.webm`. Removes the v2 jagged halo / green fringe (see `previews/walter-raw-goldmine-v3-edge-15s.jpg`). `master/head.json` regenerated from the new matte.
- Join zooms changed for the bigger framing (see ESCENAS.md); every join still changes scale (qa gate).

## v3.1 (Sun Nov 1, 2026, PT) — face fix + music
Picture cuts unchanged from v3.0 (backup: previews/walter-raw-goldmine-v3.0-9x16.mp4, work/build.v3.0.mjs, work/v3.0/).
Changes: grain z 70 → 17 (under the speaker); walter-alpha.webm 1080x1920 → 1296x2304 (tools/make_alpha.py: Lanczos 1.2x + interior unsharp
0.40/σ1.1, CRF 14); no will-change on #camF/#cam, gsap force3D off; music.wav added (track 32, volume 1); render with --video-frame-format png.
## v3.2 (Sun Nov 1, 2026, PT) — outro appended, cut unchanged
Source cut and voice unchanged (cut.mp4 / voice.wav 24.067 s; last word "goldmine." 22.80–23.01, untouched). Picture extended to 27.30 s:
outro flood 23.35→23.95 over the last 0.72 s of footage, then the green end card alone (logo 23.85, URL 24.25, hold to 27.30).
Voice room tone continues to 24.067 under the music, then the music alone. Timing lives in master/layout.json → OUTRO.

## v3.3
Cut unchanged (same keep.json, same joins). Visual-only fixes at the 4.6 s join; no speech moved or stretched.
