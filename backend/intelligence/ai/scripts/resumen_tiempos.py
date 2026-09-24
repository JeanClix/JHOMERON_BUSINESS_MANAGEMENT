"""Resume logs/tiempos_chat.jsonl (ver src/tiempos.py): en qué se va el
tiempo de las preguntas del chat, agrupado por modelo/proveedor.

Uso (desde backend/intelligence/ai, con el venv activado):
    python -m scripts.resumen_tiempos
    python -m scripts.resumen_tiempos --ultimas 30
    python -m scripts.resumen_tiempos --archivo otra/ruta.jsonl

Pensado para comparar proveedores con las mismas preguntas: correr una
tanda con un LLM_* en .env, cambiarlo, correr otra tanda, y ver ambas
filas lado a lado.
"""
import argparse
import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def _percentil(valores: list[int], p: float) -> int:
    if not valores:
        return 0
    ordenados = sorted(valores)
    indice = min(len(ordenados) - 1, round(p * (len(ordenados) - 1)))
    return ordenados[indice]


def _leer(ruta: Path) -> list[dict]:
    trazas = []
    with ruta.open(encoding="utf-8") as f:
        for linea in f:
            linea = linea.strip()
            if linea:
                trazas.append(json.loads(linea))
    return trazas


def _resumir(nombre: str, trazas: list[dict]) -> None:
    ok = [t for t in trazas if t["exito"]]
    totales = [t["total_ms"] for t in ok]
    print(f"\n=== {nombre}")
    print(f"preguntas: {len(trazas)}  (fallidas: {len(trazas) - len(ok)})")
    if not ok:
        return
    print(f"total      p50={_percentil(totales, 0.5):>6} ms   p90={_percentil(totales, 0.9):>6} ms   max={max(totales):>6} ms")

    suma_total = sum(totales) or 1
    for campo, etiqueta in (
        ("llm_ms", "LLM (respondiendo)"),
        ("espera_rate_limit_ms", "esperas rate limit"),
        ("tools_ms", "tools SQL/RAG"),
        ("otros_ms", "otros (auditoría, etc.)"),
    ):
        suma = sum(t[campo] for t in ok)
        print(f"  {etiqueta:<24} {100 * suma / suma_total:5.1f}% del tiempo   prom={suma // len(ok):>6} ms")

    con_espera = sum(1 for t in ok if t["espera_rate_limit_ms"] > 0)
    print(f"preguntas con espera por rate limit: {con_espera}/{len(ok)}")
    print(f"rondas por pregunta: prom={statistics.mean(t['num_rondas'] for t in ok):.1f}  max={max(t['num_rondas'] for t in ok)}")

    llamadas = [r for t in ok for r in t["rondas"] if r["llm_ms"]]
    if llamadas:
        print(f"ms por llamada al LLM: p50={_percentil([r['llm_ms'] for r in llamadas], 0.5)}  p90={_percentil([r['llm_ms'] for r in llamadas], 0.9)}")
    print(f"tokens por pregunta: entrada prom={sum(t['tokens_entrada'] for t in ok) // len(ok)}  salida prom={sum(t['tokens_salida'] for t in ok) // len(ok)}")
    razonamiento = [r["tokens_razonamiento"] for t in ok for r in t["rondas"] if r.get("tokens_razonamiento")]
    if razonamiento:
        print(f"  de la salida, razonamiento prom por llamada: {sum(razonamiento) // len(razonamiento)}")

    tools = defaultdict(list)
    for t in ok:
        for r in t["rondas"]:
            for tool in r["tools"]:
                tools[tool["nombre"]].append(tool["ms"])
    for nombre_tool, tiempos in sorted(tools.items()):
        print(f"  tool {nombre_tool:<18} n={len(tiempos):<4} p50={_percentil(tiempos, 0.5)} ms  p90={_percentil(tiempos, 0.9)} ms")

    lentas = sorted(ok, key=lambda t: t["total_ms"], reverse=True)[:3]
    print("más lentas:")
    for t in lentas:
        print(f"  {t['total_ms']:>6} ms  rondas={t['num_rondas']}  espera_rl={t['espera_rate_limit_ms']} ms  «{t['pregunta'][:70]}»")


def main() -> None:
    from src.config import settings

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--archivo", default=settings.tiempos_log_path)
    parser.add_argument("--ultimas", type=int, default=None, help="solo las últimas N preguntas")
    args = parser.parse_args()

    ruta = Path(args.archivo)
    if not ruta.is_file():
        print(f"No existe {ruta} -- haz algunas preguntas en el chat primero.")
        return
    trazas = _leer(ruta)
    if args.ultimas:
        trazas = trazas[-args.ultimas:]

    por_modelo: dict[str, list[dict]] = defaultdict(list)
    for t in trazas:
        por_modelo[f"{t['modelo']} @ {t['proveedor']}"].append(t)
    for nombre, grupo in por_modelo.items():
        _resumir(nombre, grupo)


if __name__ == "__main__":
    main()
