"""CRUD de la base de conocimiento institucional (ai.documento_contexto) --
ver comentario de la tabla en schema-ai.sql. Alta/edicion/baja requieren
GERENCIA o ADMIN (mismo criterio que /insights/*); la lectura via chat
(buscar_base_conocimiento en tools.py) no pasa por este router, consulta la
tabla directo con el rol del usuario ya resuelto.

Extraccion de texto por formato: .md/.txt se leen tal cual, .pdf con pypdf,
.docx con python-docx. Un PDF escaneado sin capa de texto no funciona (no hay
OCR) -- se le informa al usuario en el mensaje de error en vez de guardar un
documento vacio.
"""
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from .auth import get_current_claims, require_gerencia
from .db import get_connection

router = APIRouter(prefix="/documentos", tags=["documentos"])

CATEGORIAS_VALIDAS = {"general", "lineas-producto", "procesos", "financiero", "politicas"}
ROLES_VALIDOS = {"VENDEDOR", "GERENCIA", "ADMIN"}


def _extraer_texto(nombre_archivo: str, contenido_bytes: bytes) -> tuple[str, str]:
    """Devuelve (texto_extraido, formato_original). Lanza HTTPException 422
    si el formato no es soportado o no se pudo extraer texto real."""
    extension = nombre_archivo.rsplit(".", 1)[-1].lower() if "." in nombre_archivo else ""

    if extension in ("md", "txt"):
        try:
            return contenido_bytes.decode("utf-8"), extension
        except UnicodeDecodeError:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "El archivo no es texto UTF-8 válido.")

    if extension == "pdf":
        try:
            from pypdf import PdfReader
        except ImportError:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Falta la librería pypdf en el servidor.")
        lector = PdfReader(BytesIO(contenido_bytes))
        texto = "\n\n".join(pagina.extract_text() or "" for pagina in lector.pages).strip()
        if not texto:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "No se pudo extraer texto de este PDF (probablemente es un escaneo sin capa de texto -- no hay OCR).",
            )
        return texto, extension

    if extension == "docx":
        try:
            from docx import Document as DocxDocument
        except ImportError:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Falta la librería python-docx en el servidor.")
        doc = DocxDocument(BytesIO(contenido_bytes))
        texto = "\n\n".join(p.text for p in doc.paragraphs if p.text.strip()).strip()
        if not texto:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "El documento .docx no tiene texto.")
        return texto, extension

    raise HTTPException(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        f"Formato .{extension} no soportado -- usa .md, .txt, .pdf o .docx.",
    )


def _resumen(contenido: str, largo: int = 220) -> str:
    plano = " ".join(contenido.split())
    return plano if len(plano) <= largo else plano[:largo].rstrip() + "…"


def _fila_a_documento(fila: dict, con_contenido: bool) -> dict:
    doc = {
        "id": fila["id"],
        "titulo": fila["titulo"],
        "categoria": fila["categoria"],
        "formato_original": fila["formato_original"],
        "roles_visibles": fila["roles_visibles"],
        "subido_por": fila["subido_por"],
        "activo": fila["activo"],
        "fecha_creacion": fila["fecha_creacion"].isoformat(),
        "fecha_actualizacion": fila["fecha_actualizacion"].isoformat(),
        "resumen": _resumen(fila["contenido"]),
    }
    if con_contenido:
        doc["contenido"] = fila["contenido"]
    return doc


def _validar_categoria(categoria: str) -> str:
    if categoria not in CATEGORIAS_VALIDAS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Categoría inválida: {categoria}")
    return categoria


def _validar_roles(roles: list[str]) -> list[str]:
    roles_limpios = [r.upper() for r in roles if r]
    invalidos = set(roles_limpios) - ROLES_VALIDOS
    if invalidos:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Roles inválidos: {', '.join(invalidos)}")
    if not roles_limpios:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Debe indicarse al menos un rol visible.")
    return roles_limpios


@router.get("")
def listar(_claims: dict = Depends(require_gerencia)):
    with get_connection() as conn:
        filas = conn.execute(
            """
            SELECT id, titulo, categoria, contenido, formato_original, roles_visibles,
                   subido_por, activo, fecha_creacion, fecha_actualizacion
            FROM ai.documento_contexto
            ORDER BY fecha_actualizacion DESC
            """
        ).fetchall()
    return {"documentos": [_fila_a_documento(f, con_contenido=False) for f in filas]}


@router.get("/{doc_id}")
def obtener(doc_id: int, _claims: dict = Depends(require_gerencia)):
    with get_connection() as conn:
        fila = conn.execute(
            """
            SELECT id, titulo, categoria, contenido, formato_original, roles_visibles,
                   subido_por, activo, fecha_creacion, fecha_actualizacion
            FROM ai.documento_contexto WHERE id = %s
            """,
            (doc_id,),
        ).fetchone()
    if not fila:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado.")
    return _fila_a_documento(fila, con_contenido=True)


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear(
    titulo: str = Form(...),
    categoria: str = Form(...),
    roles_visibles: list[str] = Form(...),
    archivo: UploadFile = File(...),
    claims: dict = Depends(get_current_claims),
    _: None = Depends(require_gerencia),
):
    categoria = _validar_categoria(categoria)
    roles = _validar_roles(roles_visibles)
    contenido_bytes = await archivo.read()
    texto, formato = _extraer_texto(archivo.filename or "", contenido_bytes)

    with get_connection() as conn:
        fila = conn.execute(
            """
            INSERT INTO ai.documento_contexto (titulo, categoria, contenido, formato_original, roles_visibles, subido_por)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, titulo, categoria, contenido, formato_original, roles_visibles,
                      subido_por, activo, fecha_creacion, fecha_actualizacion
            """,
            (titulo, categoria, texto, formato, roles, claims.get("sub")),
        ).fetchone()
    return _fila_a_documento(fila, con_contenido=True)


@router.put("/{doc_id}")
async def actualizar(
    doc_id: int,
    titulo: str | None = Form(default=None),
    categoria: str | None = Form(default=None),
    roles_visibles: list[str] | None = Form(default=None),
    archivo: UploadFile | None = File(default=None),
    _claims: dict = Depends(require_gerencia),
):
    with get_connection() as conn:
        existente = conn.execute("SELECT id FROM ai.documento_contexto WHERE id = %s", (doc_id,)).fetchone()
        if not existente:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado.")

        campos: dict = {"fecha_actualizacion": datetime.utcnow()}
        if titulo is not None:
            campos["titulo"] = titulo
        if categoria is not None:
            campos["categoria"] = _validar_categoria(categoria)
        if roles_visibles is not None:
            campos["roles_visibles"] = _validar_roles(roles_visibles)
        if archivo is not None and archivo.filename:
            contenido_bytes = await archivo.read()
            texto, formato = _extraer_texto(archivo.filename, contenido_bytes)
            campos["contenido"] = texto
            campos["formato_original"] = formato

        set_clause = ", ".join(f"{campo} = %s" for campo in campos)
        fila = conn.execute(
            f"""
            UPDATE ai.documento_contexto SET {set_clause} WHERE id = %s
            RETURNING id, titulo, categoria, contenido, formato_original, roles_visibles,
                      subido_por, activo, fecha_creacion, fecha_actualizacion
            """,
            (*campos.values(), doc_id),
        ).fetchone()
    return _fila_a_documento(fila, con_contenido=True)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(doc_id: int, _claims: dict = Depends(require_gerencia)):
    with get_connection() as conn:
        resultado = conn.execute("DELETE FROM ai.documento_contexto WHERE id = %s", (doc_id,))
        if resultado.rowcount == 0:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento no encontrado.")
