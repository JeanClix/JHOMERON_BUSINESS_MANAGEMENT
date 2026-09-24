"""Carga el corpus semilla de documentacion/contexto-empresa/*.md a rag.*.

Uso (desde backend/intelligence/ai, con el venv activado):
    python -m scripts.seed_rag

Llama a documentos.crear_documento() directo (sin pasar por HTTP) -- sirve
también de smoke test del pipeline completo (extracción, chunking,
embeddings, insert) antes de probar la carga desde el frontend.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.documentos import crear_documento  # noqa: E402

_CORPUS_DIR = Path(__file__).parent.parent.parent.parent.parent / "documentacion" / "contexto-empresa"

# (nombre de archivo, título, categoría) -- README.md del corpus queda
# afuera a propósito, es un índice para humanos, no contenido para el chat.
_DOCUMENTOS = [
    ("00-empresa.md", "Acerca de Industrias Jhomeron S.A.", "general"),
    ("01-lineas-producto.md", "Catálogo de productos por línea", "lineas-producto"),
    ("02-puntos-venta-contacto.md", "Puntos de venta y contacto", "general"),
    ("03-terminos-condiciones.md", "Términos y condiciones (resumen)", "politicas"),
]


def main() -> None:
    if not _CORPUS_DIR.is_dir():
        raise SystemExit(f"No se encontró el directorio de corpus: {_CORPUS_DIR}")

    for nombre_archivo, titulo, categoria in _DOCUMENTOS:
        ruta = _CORPUS_DIR / nombre_archivo
        if not ruta.is_file():
            print(f"[saltado] {nombre_archivo} no existe en {_CORPUS_DIR}")
            continue
        resultado = crear_documento(
            titulo=titulo,
            categoria=categoria,
            roles_visibles=None,  # default: visible para los 3 roles
            nombre_archivo=nombre_archivo,
            archivo_bytes=ruta.read_bytes(),
            subido_por="seed_rag.py",
        )
        print(f"[ok] {titulo} -> documento #{resultado['id']}, {resultado['num_chunks']} chunks")


if __name__ == "__main__":
    main()
