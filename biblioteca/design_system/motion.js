/* ============================================================================
   MOI MOTION — el vocabulario de movimiento del pipeline de video.
   13-ago-2026. Se carga en TODA escena: <script src="design_system/motion.js">

   POR QUÉ EXISTE
   Walter, sobre el corte de "qué es una startup": "este video particularmente
   estoy más aburrido, tenemos que tener más dinamismo... el ease in, el ease out
   de todas las transiciones tiene que ser mucho más dinámico de lo normal."

   Hasta hoy cada escena tecleaba su propio `back.out(1.9)` y su propia duración.
   Eso produce dos fallas: (1) el video entero tiene una sola textura de movimiento
   —todo entra igual— y (2) `back.out` es un overshoot ARITMÉTICO: pasa el objetivo
   y vuelve por una curva que no existe en el mundo físico, y a ojo lee CARICATURA.

   Acá el overshoot sale de la solución cerrada de un resorte amortiguado. Es la
   misma sensación que las animaciones de iOS: arranque rápido, asentamiento largo.
   Y es una FUNCIÓN PURA del progreso — sin estado, sin integrador — así que el
   render frame-a-frame la puede buscar en cualquier orden sin desincronizarse.
   (Un resorte en tiempo real acumula velocidad frame a frame: no se puede seekear.)

   LAS 3 REGLAS
   1. Ninguna escena declara un ease a mano. Sale de MOI.ease.
   2. La energía se elige por INTENCIÓN (`snap`, `pop`, `settle`, `drift`), no por número.
   3. Sólo transform y opacidad. Nada de width/height/top/left/letterSpacing
      — se redondean a píxel entero y el render TARTAMUDEA (SCENE_PLAYBOOK §3c-1).
   ========================================================================== */
(function () {
  "use strict";

  /* ---- el resorte amortiguado, en forma cerrada -------------------------
     response        ≈ segundos que tardaría una oscilación (0,25–0,6)
     damping   1.00  = críticamente amortiguado, CERO overshoot
               0.82  ≈ registro iOS: ~1,5% de overshoot, se siente y no se ve
               0.62  = el efusivo de Walter — reemplaza a back.out(1.9)
               <0.55 = caricatura. No.                                        */
  function spring(response, damping) {
    var w = (2 * Math.PI) / response, z = damping, pos;
    if (z < 1) {
      var wd = w * Math.sqrt(1 - z * z);
      pos = function (t) {
        return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
      };
    } else if (z > 1) {
      var wo = w * Math.sqrt(z * z - 1);
      pos = function (t) {
        return 1 - Math.exp(-z * w * t) * (Math.cosh(wo * t) + ((z * w) / wo) * Math.sinh(wo * t));
      };
    } else {
      pos = function (t) { return 1 - Math.exp(-w * t) * (1 + w * t); };
    }
    // Tiempo de asentamiento: el último instante fuera de ±0,1% del objetivo.
    // Barrido de paso fijo, una sola vez al cargar → determinista.
    var rate = z <= 1 ? z * w : (z - Math.sqrt(z * z - 1)) * w;
    var SCAN = 12 / rate, N = 4800, T = SCAN;
    for (var i = N; i >= 0; i--) {
      var t = (i / N) * SCAN;
      if (Math.abs(1 - pos(t)) > 0.001) { T = ((i + 1) / N) * SCAN; break; }
    }
    var xT = pos(T);
    return {
      duration: T,
      ease: function (p) { return pos(p * T) + p * (1 - xT); }
    };
  }

  var S = {
    snap:    spring(0.28, 1.00),  // el golpe seco: chips, badges, contadores
    settle:  spring(0.40, 1.00),  // la casa: entradas normales, sin overshoot
    alive:   spring(0.42, 0.82),  // "vivo, no rebotón" — el default de este video
    pop:     spring(0.46, 0.62),  // EFUSIVO — sólo el money-beat de cada escena
    weight:  spring(0.62, 0.90)   // aterrizaje pesado: un número grande cayendo
  };

  var MOI = {
    spring: spring,

    /* Los eases con nombre. `ease` es la curva; `dur` el asentamiento físico.
       Se usan LOS DOS — la duración ES parte de la física; pisarla con un número
       arbitrario re-temporiza la misma curva y se pierde el sentido del resorte. */
    ease: {
      snap: S.snap.ease, settle: S.settle.ease, alive: S.alive.ease,
      pop: S.pop.ease, weight: S.weight.ease,
      drift: "sine.inOut",     // vida ambiente, yoyo
      cut: "power4.in",        // salidas: acelera y se va
      camera: "power2.inOut",  // el zoom del footage. NUNCA un ease con overshoot:
                               // una cámara que rebota se lee como error de tracking
      linear: "none"
    },
    dur: {
      snap: S.snap.duration, settle: S.settle.duration, alive: S.alive.duration,
      pop: S.pop.duration, weight: S.weight.duration
    },

    /* ---- ENTRADA --------------------------------------------------------
       Con ANTICIPACIÓN: antes de entrar, el elemento retrocede un pelo en
       contra de su dirección. Es el principio de animación más viejo que hay
       y el que más energía agrega por milisegundo — un elemento que sólo
       aparece se lee plano por muy buena que sea su curva.

       dir: 'up'|'down'|'left'|'right'|'none'   energy: 'snap'|'settle'|'alive'|'pop'|'weight'  */
    enter: function (tl, target, at, o) {
      o = o || {};
      var energy = o.energy || "alive", dist = o.dist == null ? 44 : o.dist;
      var dir = o.dir || "up", sc = o.scale == null ? 0.94 : o.scale;
      var v = { up: [0, dist], down: [0, -dist], left: [dist, 0], right: [-dist, 0], none: [0, 0] }[dir];
      var anti = o.anticipate === false ? 0 : 0.10;

      // La opacidad viaja SIEMPRE en su propio tween con curva sin overshoot.
      // Dos razones: (1) una curva que se pasa del objetivo empujaría opacity > 1;
      // (2) si el tween de movimiento también tocara opacity, serían dos tweens
      // sobre la misma propiedad del mismo target a la vez — el bug no determinista
      // de SCENE_PLAYBOOK §3c-3, que `hyperframes check` marca como error.
      if (anti) {
        // el retroceso: un 18% del recorrido, EN CONTRA, corto y con freno.
        // Es el principio de anticipación — lo que separa "aparece" de "llega".
        tl.fromTo(target,
          { x: v[0], y: v[1], scale: sc },
          { x: v[0] * 1.18, y: v[1] * 1.18, duration: 0.10, ease: "power2.out" }, at);
        tl.fromTo(target, { opacity: 0 },
          { opacity: 0.35, duration: 0.10, ease: "none" }, at);
        tl.to(target, {
          x: 0, y: 0, scale: 1,
          duration: MOI.dur[energy], ease: MOI.ease[energy]
        }, at + anti);
        tl.to(target, { opacity: 1, duration: 0.24, ease: "power2.out" }, at + anti);
      } else {
        tl.fromTo(target,
          { x: v[0], y: v[1], scale: sc },
          { x: 0, y: 0, scale: 1, duration: MOI.dur[energy], ease: MOI.ease[energy] }, at);
        tl.fromTo(target, { opacity: 0 },
          { opacity: 1, duration: 0.24, ease: "power2.out" }, at);
      }
      return tl;
    },

    /* ---- SALIDA — acelera hacia afuera. Nunca un fade parejo: un fade lineal
       es la salida más barata que existe y deja la pantalla muerta 300 ms. */
    exit: function (tl, target, at, o) {
      o = o || {};
      var dist = o.dist == null ? 34 : o.dist, dir = o.dir || "up";
      var v = { up: [0, -dist], down: [0, dist], left: [-dist, 0], right: [dist, 0], none: [0, 0] }[dir];
      tl.to(target, {
        x: v[0], y: v[1], scale: o.scale == null ? 0.97 : o.scale, opacity: 0,
        duration: o.duration || 0.30, ease: MOI.ease.cut
      }, at);
      return tl;
    },

    /* ---- CASCADA — varios elementos con solape. El solape es lo que la hace
       leer como UN gesto y no como N entradas en fila. */
    cascade: function (tl, targets, at, o) {
      o = o || {};
      var each = o.each == null ? 0.075 : o.each;
      var list = typeof targets === "string" ? document.querySelectorAll(targets) : targets;
      Array.prototype.forEach.call(list, function (el, i) {
        MOI.enter(tl, el, at + i * each, o);
      });
      return tl;
    },

    /* ---- PUNCH — el golpe de escala cuando algo ATERRIZA (un número, una
       palabra). Sube rápido, vuelve con resorte. */
    punch: function (tl, target, at, amount) {
      var a = amount == null ? 1.14 : amount;
      tl.to(target, { scale: a, duration: 0.11, ease: "power3.out" }, at)
        .to(target, { scale: 1, duration: S.snap.duration, ease: S.snap.ease }, at + 0.11);
      return tl;
    },

    /* ---- STAMP — la palabra clave que cae desde arriba del espectador.
       Entra grande y desenfocada de escala, aterriza, y sacude su contenedor. */
    stamp: function (tl, target, at, shakeTarget) {
      tl.fromTo(target, { scale: 2.1, opacity: 0 },
        { scale: 1, opacity: 1, duration: S.weight.duration, ease: S.weight.ease }, at);
      if (shakeTarget) {
        var t = at + S.weight.duration * 0.42;
        tl.to(shakeTarget, { x: 7, duration: 0.045, ease: "none" }, t)
          .to(shakeTarget, { x: -5, duration: 0.05, ease: "none" }, t + 0.045)
          .to(shakeTarget, { x: 2, duration: 0.05, ease: "none" }, t + 0.095)
          .to(shakeTarget, { x: 0, duration: 0.07, ease: "power2.out" }, t + 0.145);
      }
      return tl;
    },

    /* ---- BREATHE — vida continua. Ninguna card quieta más de 2 s
       (estándar Wallbit 2). `repeat` SIEMPRE finito: -1 rompe el render. */
    breathe: function (tl, target, at, o) {
      o = o || {};
      var span = o.span || 4, amp = o.amp == null ? 7 : o.amp, cycle = o.cycle || 2.2;
      var n = Math.max(1, Math.floor(span / cycle));
      tl.to(target, {
        y: -amp, duration: cycle / 2, ease: "sine.inOut",
        repeat: n * 2 - 1, yoyo: true
      }, at);
      return tl;
    },

    /* ---- CAMERA — el zoom sobre el FOOTAGE. Ver master/CAMARA.md.
       kind: 'in' | 'out' | 'hold'
       El `hold` no es "sin zoom": es una escala FIJA distinta a la del vecino.
       Ahí está el truco — el corte entre dos escalas distintas lee como
       segunda cámara y disimula el salto del jump cut. Una escena que se queda
       en 1.00 después de otra en 1.00 es la única que sí se ve muerta. */
    camera: function (tl, target, at, span, kind, o) {
      o = o || {};
      var from = o.from, to = o.to;
      if (from == null || to == null) {
        var base = o.base == null ? 1.0 : o.base;
        var amt = o.amount == null ? 0.09 : o.amount;
        if (kind === "in") { from = base; to = base + amt; }
        else if (kind === "out") { from = base + amt; to = base; }
        else { from = to = base; }
      }
      var ox = o.originX == null ? 50 : o.originX, oy = o.originY == null ? 38 : o.originY;
      tl.set(target, { transformOrigin: ox + "% " + oy + "%" }, at);
      if (from === to) {
        tl.set(target, { scale: from }, at);
      } else {
        /* ⛔ immediateRender:false — SIN ESTO EL CUADRO 0 SALE MAL (17-ago-2026).
           Un fromTo renderiza su estado inicial al CREARSE. Con varios tramos de
           cámara sobre el mismo target, el último creado le escribe su `from` al
           elemento, y en t=0 el video arranca en la escala de un tramo que
           ocurre dos minutos después — y salta al cuadro siguiente. Medido en
           uplabs: t=0 daba 1.10 cuando el primer tramo declara 1.05.
           Es la variante para tweens secuenciados del mismo bug que el archivo
           ya documenta para las escenas ("un set en t=0 es ambiguo al seekear"). */
        tl.fromTo(target, { scale: from },
          { scale: to, duration: span, ease: MOI.ease.camera, immediateRender: false }, at);
      }
      return tl;
    }
  };

  window.MOI = MOI;
})();
