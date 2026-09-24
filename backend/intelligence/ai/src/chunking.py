"""Extracción de texto de archivos subidos + troceo (chunking) para RAG.

Chunking por caracteres (no por tokens con tiktoken) a propósito: mantiene
las dependencias livianas, igual criterio que el resto de este servicio
(ver requirements.txt). ~1200 caracteres son ~250-350 tokens en español,
suficiente contexto por fragmento sin desperdiciar presupuesto del LLM.
"""
import io
import re

from docx import Document as DocxDocument
from pypdf import PdfReader


class ExtraccionError(Exception):
    pass


def extraer_texto(nombre_archivo: str, contenido: bytes) -> str:
    extension = nombre_archivo.rsplit(".", 1)[-1].lower() if "." in nombre_archivo else ""

    if extension in ("md", "txt"):
        texto = contenido.decode("utf-8", errors="replace")
    elif extension == "pdf":
        texto = _extraer_pdf(contenido)
    elif extension == "docx":
        texto = _extraer_docx(contenido)
    else:
        raise ExtraccionError(
            f"Formato .{extension or '?'} no soportado. Formatos aceptados: .md, .txt, .pdf, .docx."
        )

    texto = texto.strip()
    if not texto:
        raise ExtraccionError(
            "No se pudo extraer texto del archivo. Si es un PDF escaneado (imagen sin capa "
            "de texto), conviértelo a texto antes de subirlo -- este servicio no hace OCR."
        )
    return texto


def _extraer_pdf(contenido: bytes) -> str:
    lector = PdfReader(io.BytesIO(contenido))
    paginas = [pagina.extract_text() or "" for pagina in lector.pages]
    return "\n\n".join(p for p in paginas if p.strip())


def _extraer_docx(contenido: bytes) -> str:
    doc = DocxDocument(io.BytesIO(contenido))
    parrafos = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(parrafos)


_PARRAFO = re.compile(r"\n\s*\n")


def chunear(texto: str, tam_objetivo: int = 1200, solape: int = 150) -> list[str]:
    """Empaquetado goloso por párrafo: junta párrafos consecutivos hasta
    acercarse a tam_objetivo caracteres, y repite las últimas `solape`
    caracteres del chunk anterior al inicio del siguiente -- para que una
    idea partida justo en el borde de un chunk no pierda contexto."""
    parrafos = [p.strip() for p in _PARRAFO.split(texto) if p.strip()]
    if not parrafos:
        return [texto[:tam_objetivo]] if texto else []

    chunks: list[str] = []
    actual = ""
    for parrafo in parrafos:
        candidato = f"{actual}\n\n{parrafo}" if actual else parrafo
        if len(candidato) <= tam_objetivo or not actual:
            actual = candidato
        else:
            chunks.append(actual)
            cola = actual[-solape:] if solape else ""
            actual = f"{cola}\n\n{parrafo}" if cola else parrafo
    if actual:
        chunks.append(actual)
    return chunks
