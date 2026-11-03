# Activos externos — no van en el repo

El formato `qmd-vertical` los usa. Pesan, o tienen una licencia que no se redistribuye acá. El código sí está en `pipeline/tools/`. Cada herramienta recibe la ruta por argumento; ninguna apunta a un disco fijo.

## Mate (RVM)

| Qué | Dónde ponerlo | De dónde sale |
|---|---|---|
| `rvm_resnet50_fp32.onnx` | `~/.cache/rvm/rvm_resnet50_fp32.onnx` (o `--weights`) | [PeterL1n/RobustVideoMatting](https://github.com/PeterL1n/RobustVideoMatting), modelo ONNX resnet50 fp32. En goldmine v3.3 se corrió en CPU con `downsample_ratio` 0.4 |
| `rvm_mobilenetv3_fp32.onnx` | el mismo directorio | el mismo repo, la variante liviana (`--model mobilenetv3`) |

`rvm_matte.py` lo dice si el archivo no está. Hace falta `onnxruntime`.

## Música

Medido en goldmine v3.3 (`pipeline/styles/qmd-vertical/referencia/music-report.json`): piano de punta a punta, duck de 5 dB, la voz 12.4 dB por encima en 300–3500 Hz, mezcla de preview a −14.3 LUFS.

| Qué | Licencia | De dónde sale |
|---|---|---|
| Salamander Grand Piano V3, SF2 (`SalamanderGrandPiano-V3+20200602.sf2`) | CC-BY 3.0 (Alexander Holm; el SF2 lo armó FreePats) | [FreePats / Salamander](https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html). El aviso está en `pipeline/docs/musica-licencias/SalamanderGrandPiano-readme.txt` |
| `MuseScore_General.sf2` (bajo, pizzicato, cuerdas, pad, crash) | MIT | MuseScore. El aviso está en `pipeline/docs/musica-licencias/MuseScore_General_License.md` |
| `kick.wav`, `snare.wav`, `hat.wav` | one-shots cortados de stems con licencia de la casa (los mismos que usó optimismo v3) | no se commitean. `music.py --render` los pide con `--drums` |

Render: FluidSynth (`--fluidsynth`, el binario del sistema o de un venv). `music.py` sin `--render` escribe la partitura igual, sin soundfonts. La mezcla la cierra `master_mix.py` (limitador a −1.8 dBTP para que el AAC de HyperFrames no baje todo el video).

## SFX

Muestras reales, alineadas a su pico (`sfx.py --library`). En v3.3 salieron de la librería de la casa (whoosh, click, pop, boom, shimmer, riser). No están en el repo: cada archivo se licencia en el `PROVENANCE.md` del episodio, no acá.

## Qué sí está

Fuentes (Instrument Sans, Geist Mono) y los SVG de QMD, en `biblioteca/`. Los logos de terceros que se vieron en goldmine v3.3 están en `biblioteca/logos/qmd/terceros/` con una nota de procedencia: llegaron con el paquete de ese video, no se regeneran.
