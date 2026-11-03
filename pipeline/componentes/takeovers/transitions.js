/* transitions.js — the shared cut/takeover vocabulary, brand-agnostic and format-agnostic.
   Extracted from pipeline/templates/transiciones-corte.js (Cvander micro-podcast) and
   generalised: every function takes the GSAP timeline and selector, no globals, no colours.
   Blur/scale are relative, so they read the same on 16:9 and 9:16.

   cutT(tl, sel, t, f)      a jump cut on footage or a whole scene: blur+brightness peak at t.
                            f=1 same subject, 1.6 change of subject (Cvander values).
   tkIn(tl, sel, t)         takeover enters: from scale 1.07 + blur 16px to rest (0.36 s).
   tkOut(tl, sel, t)        takeover leaves: to scale .96 + blur 14px + fade (0.24 s).
   flood(tl, sel, t, d, x, y)  mode change: grows a .tk-flood circle from (x%,y%) to full frame.
   dive(tl, sel, t, d, s)   "zoom into the word until it becomes the world": scale an element
                            (s≈18) about its own centre; pair with flood() for the new ground.
   hl(tl, sel, t, d)        highlighter wipe on a .tk-hl (sets --hl-p 0→1).
   drop(tl, sel, t)         a tag/card drops onto the material (y from -8% + small rotate, no bounce).
   respiro()                T7 of the Cvander set: deliberately no effect. Documented, not code.

   Easing follows the brand energy: sober brands (QMD) never overshoot.

   BUG de brillo (goldmine v3.3, join 4.6 s): si un tween de filter ARRANCA en "none",
   GSAP rellena el brightness que falta con 0 y la persona queda en silueta negra.
   cutT arranca siempre de un blur() + brightness() mayor que 0. Prohibido
   tl.from(orador, {filter:"none"}) y brightness(0) sobre la persona. */
(function (g) {
  var E = { out: "power3.out", in: "power2.in", io: "power2.inOut" };
  function cutT(tl, sel, t, f) {
    f = f || 1;
    var b = "blur(" + 9 * f + "px) brightness(" + (1 + 0.12 * f) + ")";
    tl.to(sel, { filter: b, scale: 1 + 0.03 * f, duration: 0.1, ease: E.in }, t - 0.1);
    tl.fromTo(sel, { filter: b, scale: 1 + 0.05 * f },
      { filter: "blur(0px) brightness(1)", scale: 1, duration: 0.3, ease: E.out, immediateRender: false }, t);
  }
  function tkIn(tl, sel, t) {
    tl.fromTo(sel, { scale: 1.07, filter: "blur(16px)", opacity: 0 },
      { scale: 1, filter: "blur(0px)", opacity: 1, duration: 0.36, ease: E.out }, t);
  }
  function tkOut(tl, sel, t) {
    tl.to(sel, { scale: 0.96, filter: "blur(14px)", opacity: 0, duration: 0.24, ease: E.in }, t);
  }
  function flood(tl, sel, t, d, x, y) {
    var at = " at " + (x == null ? 50 : x) + "% " + (y == null ? 50 : y) + "%)";
    tl.fromTo(sel, { clipPath: "circle(0%" + at },
      { clipPath: "circle(150%" + at, duration: d || 0.7, ease: "power2.inOut" }, t);
  }
  function dive(tl, sel, t, d, s) {
    tl.to(sel, { scale: s || 18, duration: d || 0.7, ease: "power3.in", transformOrigin: "50% 50%" }, t);
  }
  function hl(tl, sel, t, d) {
    tl.fromTo(sel, { "--hl-p": 0 }, { "--hl-p": 1, duration: d || 0.45, ease: E.out }, t);
  }
  function drop(tl, sel, t) {
    tl.fromTo(sel, { yPercent: -60, rotation: -6, opacity: 0 },
      { yPercent: 0, rotation: -3, opacity: 1, duration: 0.45, ease: E.out }, t);
  }
  g.TK = { cutT: cutT, tkIn: tkIn, tkOut: tkOut, flood: flood, dive: dive, hl: hl, drop: drop, ease: E };
})(window);
