/* transiciones-corte.js — que un corte del footage no "se vea cortado" (Walter, 14-oct-2026).
   Probado en Pregúntale a un humano ep. 01. Pegar DENTRO del bloque donde se arma `tl` (GSAP, paused).

   - cutT(t, f): zoom con desenfoque sobre la toma (#aroll) justo en el corte t.
       f = 1   → corte dentro de la misma persona (retake, pausa quitada)
       f = 1.6 → cambio de persona (Chris ↔ invitado): más fuerte
   - tkIn / tkOut: un takeover (gráfico a pantalla completa) entra y sale con el mismo lenguaje.
   La lista de cortes sale del corte de Walter: cada unión de archivo/tramo en el reloj del master.
   Los cambios de persona son los mismos tiempos que van a nivelar-voces.py --tramos. */

function cutT(t, f){
  var b = 'blur(' + (9*f) + 'px) brightness(' + (1 + .12*f) + ')';
  tl.to('#aroll',{filter:b,scale:1 + .03*f,duration:.1,ease:'power2.in'},t - .1);
  tl.fromTo('#aroll',{filter:b,scale:1 + .05*f},{filter:'blur(0px) brightness(1)',scale:1,duration:.3,ease:'power3.out',immediateRender:false},t);
}
function tkIn(sel, t){ tl.fromTo(sel,{scale:1.07,filter:'blur(16px)'},{scale:1,filter:'blur(0px)',duration:.36,ease:'power3.out'},t); }
function tkOut(sel, t){ tl.to(sel,{scale:.96,filter:'blur(14px)',duration:.24,ease:'power2.in'},t); }

tl.set('#aroll',{filter:'blur(0px) brightness(1)',scale:1,transformOrigin:'50% 40%'},0);
/* ep01: [[24.1,1.6],[30.1,1],[36.867,1],[50.033,1],[52.367,1],[67.233,1.6],[76.333,1],[83.1,1.6],[88.067,1],[121.8,1],[130.667,1.6],[131.8,1]] */
var CORTES = [ /* [t, f], ... */ ];
CORTES.forEach(function(c){ cutT(c[0], c[1]); });
/* takeover: tkIn('#tk-yc', 95.8); ... tkOut('#tk-yc', 108.2); */
