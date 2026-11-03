# Componentes compartidos

Piezas sacadas del master de goldmine v3.3 para que otro formato o otra marca las reutilice. Los colores son `var(--token)` de `brand.mjs tokens`. El tamaño que es una perilla (subtítulos) lo pisa `perillas.css`.

| Pieza | Archivo | Qué es |
|---|---|---|
| Takeovers | `takeovers/takeovers.css` + `transitions.js` | Cajas, flood, highlighter, tarjeta final (`.tk-end`). Sirven en 16:9 y 9:16 |
| Modos | `modos.css` | `.mode-light` y `.mode-green`. No hay `.mode-dark` |
| Fuentes | `fuentes.css` | Instrument Sans (redonda e itálica) y Geist Mono |
| Suelo | `fondos-luz.css` | Manchas, topo, puntos, haz, grano **debajo** de la cara |
| Placa | `placa.css` | Placa apaisada que la cabeza rompe, y la sombra de contacto |
| Odómetro | `odometro.css` + `odometro.js` | Roll del número héroe. El fantasma lleva 8 % de relleno para que el lint vea el texto |
| Logos | `rejilla-logos.css` | Grilla 3·2·3 y la fila de laboratorios |
| Subtítulos | `subtitulos.css` | 50 px de base, énfasis en lima, tres modos (full / stage / green) |
| Cierre | `fin-verde.css` + `fin-verde.html` | Logo + dominio, sin CTA |

`transitions.js` documenta el bug de GSAP: un filtro que arranca en `"none"` pasa por `brightness(0)`.
