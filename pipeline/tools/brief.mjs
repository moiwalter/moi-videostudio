#!/usr/bin/env node
/**
 * brief.mjs — LO QUE HAY QUE PREGUNTAR ANTES DE TOCAR NADA.
 *
 * ⛔ POR QUÉ ES UN COMANDO Y NO UNA CONVERSACIÓN (30-ago-2026, pedido de Walter: "quiero que
 *    sea determinístico").
 *    Las preguntas del arranque —¿hay guía de marca? ¿hay una web de dónde sacar colores y
 *    tipografías? ¿tenés una dirección o te propongo?— dependían de que yo me acordara de
 *    hacerlas. Una regla que vive en la memoria de alguien no es una regla: es una intención.
 *    Ahora las preguntas están EN EL CÓDIGO, la respuesta vive en master/BRIEF.json, y
 *    flujo.mjs no deja pasar al mapa sin eso.
 *
 * ⛔ LO QUE ESTE ARCHIVO NO HACE: contestar. Las respuestas son de Walter. Esto sólo garantiza
 *    que las preguntas se hagan SIEMPRE y que nadie avance sin ellas.
 *
 * USO
 *   node tools/brief.mjs <slug>                       las preguntas + en qué estado está
 *   node tools/brief.mjs <slug> --marca moi
 *   node tools/brief.mjs <slug> --marca nueva --web https://uplabs.ai
 *   node tools/brief.mjs <slug> --direccion "la carrera como un tablero que se completa"
 *   node tools/brief.mjs <slug> --sin-direccion      → dispara los conceptos
 *   node tools/brief.mjs <slug> --check
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {resolveProject,config,ROOT,projectSlug} from './project.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = ROOT
const args = process.argv.slice(2)
const CON_VALOR = new Set(['--marca', '--web', '--direccion'])
const needle = args.find((a, i) => !a.startsWith('--') && !CON_VALOR.has(args[i - 1]))
const val = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1] }
const flag = (n) => args.includes('--' + n)
if (!needle) { console.error('uso: node tools/brief.mjs <slug> [--marca X] [--web URL] [--direccion "…"] [--sin-direccion] [--check]'); process.exit(1) }

const dir = projectSlug(resolveProject(needle))
const master = resolve(resolveProject(needle), 'master')
const BRIEF = join(master, 'BRIEF.json')
// --check and status are read-only.

let B = existsSync(BRIEF) ? JSON.parse(readFileSync(BRIEF, 'utf8')) : {
  _comment: 'Lo que hay que saber antes de mapear. Las preguntas están en tools/brief.mjs; las respuestas son de Walter.',
  marca: { slug: null, web: null, existe: null },
  direccion: { tiene: null, angulo: null },
}

let cambio = false
// Scaffold already records the brand. Reuse that answer; direction is still episode-specific.
const savedBrand = join(resolveProject(needle), 'brand.json')
if (!B.marca.slug && existsSync(savedBrand)) {
  const known = JSON.parse(readFileSync(savedBrand, 'utf8'))
  if (known.name) {
    B.marca = { slug: known.name, web: null, existe: existsSync(join(RAIZ, 'biblioteca/marcas', `${known.name}.json`)) }
    cambio = true
  }
}
const marca = val('marca', null)
if (marca) { B.marca.slug = marca; B.marca.existe = existsSync(join(RAIZ, 'biblioteca/marcas', `${marca}.json`)); cambio = true }
const web = val('web', null)
if (web) { B.marca.web = web; cambio = true }
const dirc = val('direccion', null)
if (dirc) { B.direccion = { tiene: true, angulo: dirc }; cambio = true }
if (flag('sin-direccion')) { B.direccion = { tiene: false, angulo: null }; cambio = true }
if (cambio && (marca || web || dirc || flag('sin-direccion'))) { mkdirSync(master,{recursive:true}); writeFileSync(BRIEF, JSON.stringify(B, null, 2) + '\n') }

/* ── qué falta ─────────────────────────────────────────────────────────────── */
const faltan = []
if (!B.marca.slug) faltan.push('marca')
else if (B.marca.existe === false && !B.marca.web) faltan.push('marca-sin-fuente')
if (B.direccion.tiene == null) faltan.push('direccion')

if (flag('check')) {
  if (!faltan.length) { console.log(`\n✓ brief completo · marca ${B.marca.slug} · ${B.direccion.tiene ? 'con dirección' : 'conceptos pendientes'}\n`); process.exit(0) }
  console.log(`\n✗ el brief está incompleto — falta: ${faltan.join(', ')}\n`)
  process.exit(1)
}

console.log(`\n  BRIEF · ${dir}\n`)

/* ── LAS PREGUNTAS. Están acá, en el código, para que se hagan siempre. ───── */
if (!B.marca.slug) {
  console.log(`  1 · ¿DE QUIÉN ES ESTE VIDEO?  (la marca manda colores, tipografías y energía)`)
  console.log(`      marcas que ya existen: ${readdirSync(join(RAIZ, 'biblioteca/marcas')).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')).join(' · ')}`)
  console.log(`      → node tools/brief.mjs ${needle} --marca <marca>\n`)
} else if (B.marca.existe === false && !B.marca.web) {
  console.log(`  1 · La marca "${B.marca.slug}" NO existe todavía. ¿De dónde saco su línea gráfica?`)
  console.log(`      ¿Hay una guía de marca? ¿Hay una web de donde pueda sacar colores y tipografías?`)
  console.log(`      → node tools/brief.mjs ${needle} --web https://…`)
  console.log(`      o armala a mano con las 6 preguntas de brands/INTAKE.md:`)
  console.log(`        node tools/brand.mjs new ${B.marca.slug}\n`)
} else {
  console.log(`  1 · marca: ${B.marca.slug}${B.marca.existe ? '' : `  (a construir desde ${B.marca.web})`}  ✓`)
}

if (B.direccion.tiene == null) {
  console.log(`  2 · ¿TENÉS UNA DIRECCIÓN?  El ángulo con el que querés que se vea el video.`)
  console.log(`      Si la tenés:  node tools/brief.mjs ${needle} --direccion "…"`)
  console.log(`      Si NO:        node tools/brief.mjs ${needle} --sin-direccion`)
  console.log(`                    → te propongo conceptos DIVERGENTES sobre los beats ya cortados,`)
  console.log(`                      elegís uno, y de ahí sale el tratamiento de cada escena.`)
  console.log(`                      Elegirlo no lo vuelve verdad dura: es dirección, se corrige después.\n`)
} else if (B.direccion.tiene) {
  console.log(`  2 · dirección: "${B.direccion.angulo}"  ✓`)
} else {
  console.log(`  2 · sin dirección propia → van conceptos cuando el mapa esté cortado  ✓`)
}

console.log(faltan.length ? `\n  falta: ${faltan.join(', ')}\n` : `\n  ✓ brief completo — ya podés mapear los beats\n`)
process.exit(faltan.length ? 1 : 0)
