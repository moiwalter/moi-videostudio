"""Pruebas de la aritmética de qmd-vertical. Las corre qmd-vertical.test.mjs."""
import unittest

import numpy as np

from qmd_lib import (
    MATTE, MEZCLA, acumular_solapes, ancla_cabeza, en_silencio, filtro_peligroso,
    ganancia_techo, hervir, limitador, luz_wrap, notas_en, partitura, plan_keep,
    quietud, refinar_palabras, reloj,
)


class Reloj(unittest.TestCase):
    def test_goldmine(self):
        r = reloj(1.08, 22.78)
        self.assertAlmostEqual(r["bpm"], 110.6, places=1)
        self.assertAlmostEqual(r["bar"], 2.17, places=2)

    def test_silencio_unico(self):
        self.assertTrue(en_silencio(21.5, 21.45, 22.78))
        self.assertFalse(en_silencio(22.78, 21.45, 22.78))
        self.assertFalse(en_silencio(1.08, 21.45, 22.78))


class Partitura(unittest.TestCase):
    def test_golpe_y_silencio(self):
        s = partitura()
        self.assertAlmostEqual(s["bpm"], 110.6, places=1)
        self.assertGreater(len(s["notes"]["piano"]), 20)
        self.assertGreater(len(notas_en(s["notes"], 1.08, 1.4)), 0)
        self.assertEqual(notas_en(s["notes"], 21.45, 22.78), [])
        self.assertGreater(len(notas_en(s["notes"], 22.78, 24.0)), 0)
        self.assertEqual(s["cadence"][0][1], "Fadd9")

    def test_determinista(self):
        a, b = partitura(), partitura()
        self.assertEqual(a["notes"]["piano"][:8], b["notes"]["piano"][:8])


class Mate(unittest.TestCase):
    def test_numeros_de_v33(self):
        self.assertEqual(MATTE["light_wrap"], 0.22)
        self.assertEqual(MATTE["choke_px"], 1)
        self.assertEqual(MATTE["feather_sigma"], 1.4)
        self.assertEqual(MATTE["prescale"], 1.2)
        self.assertEqual(MEZCLA["solape_s"], 0.27)
        self.assertEqual(MEZCLA["margen_voz_db"], 12.0)

    def test_wrap_al_22(self):
        rgb = np.zeros(3)
        escena = np.array([100.0, 0, 0])
        out = luz_wrap(rgb, escena, 1)
        self.assertAlmostEqual(out[0], 22.0)

    def test_ancla(self):
        m = np.zeros((20, 20), bool)
        m[4:12, 6:14] = True
        a = ancla_cabeza(m)
        self.assertEqual(a["top"], 4)
        self.assertAlmostEqual(a["cx"], 9.5)

    def test_hervor(self):
        a = np.full((8, 8), 0.5)
        quieto = hervir(a, a, a)
        self.assertAlmostEqual(quieto["boil_mean"], 0.0)
        salta = hervir(a, np.full_like(a, 0.9), a)
        self.assertGreater(salta["boil_mean"], 0.3)


class Corte(unittest.TestCase):
    def test_no_estira(self):
        keep = plan_keep([{"from": 1.0, "to": 2.0}], 5.0, fps=60)
        self.assertEqual(keep, [[0.0, 1.0], [2.0, 5.0]])
        self.assertAlmostEqual(sum(e - s for s, e in keep), 4.0)

    def test_palabra_en_silencio_se_corre(self):
        voz = {0.0, 0.4, 0.5, 0.6}
        out = refinar_palabras([{"w": "hola", "s": 0.1, "e": 0.7}], lambda t: round(t, 2) in voz)
        self.assertGreaterEqual(out[0]["s"], 0.4)
        self.assertLessEqual(out[0]["e"], 0.7)


class Mezcla(unittest.TestCase):
    def test_techo_de_la_voz(self):
        self.assertEqual(ganancia_techo(-20, -40), 0.0)          # 20 dB de margen, no hay que bajar
        self.assertAlmostEqual(ganancia_techo(-20, -28), -4.0)   # hay 8 dB: bajar 4 para dejar 12
        self.assertEqual(ganancia_techo(-40, -20), 0.0)          # no está hablando

    def test_limitador_baja_el_pico(self):
        x = np.zeros((1000, 2))
        x[500] = 1.0
        y, g = limitador(x, -1.8, 48000)
        self.assertLess(np.abs(y).max(), 1.0)
        self.assertLess(g.min(), 1.0)

    def test_solape_y_quietud(self):
        r = acumular_solapes([[("a", "b")]] * 5, 0.1)  # 0.5 s
        self.assertIn(("a", "b"), r["malos"])
        q = quietud([0.01] * 40, 30)  # 40/30 > 1
        self.assertFalse(q["ok"])
        self.assertTrue(quietud([1, 1, 1], 30)["ok"])


class Brillo(unittest.TestCase):
    def test_el_bug_de_gsap(self):
        self.assertTrue(filtro_peligroso('tl.from("#cam", {filter: "none"}, {filter: "blur(0px)"})'))
        self.assertTrue(filtro_peligroso("brightness(0)"))
        self.assertFalse(filtro_peligroso('filter: "blur(9px) brightness(1.12)"'))


if __name__ == "__main__":
    unittest.main()
