/* Roll de odómetro. Una cinta de N dígitos (alto 200) baja hasta el dígito `hasta`.
   goldmine v3.3: el primer dígito recorre 12 casillas (yPercent -91.6667) y el resto 11 (-90.9091),
   con desenfoque de movimiento que se apaga al aterrizar. No arranca el filtro en "none". */
export function digitos(hasta, extra) {
  const n = extra ? 12 : 11;
  let html = "";
  for (let i = 0; i < n; i++) html += `<i>${i % 10}</i>`;
  return html;
}
export function yPorciento(casillas) {
  return -((casillas - 1) / casillas) * 100;
}
export function rodar(tl, sel, t, dur, casillas) {
  tl.fromTo(sel, { yPercent: 0 }, { yPercent: yPorciento(casillas), duration: dur, ease: "power3.inOut" }, t);
  tl.fromTo(sel, { filter: "blur(5px)" }, { filter: "blur(0px)", duration: 0.2, ease: "power2.out", immediateRender: false }, t + dur - 0.12);
}
