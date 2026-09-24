"""CRUD de documentos institucionales (rag.documento / rag.chunk) para el
panel de Admin/Gerencia. La ingesta (extraer texto -> trocear -> embeber)
vive acá porque es el mismo servicio que después los recupera en el chat
(buscar_documentos, ver tools.py) -- evita duplicar el cliente de
embeddings y la conexión a rag.* en dos servicios distintos.
"""
from .chunking import chunear, extraer_texto
from .db import get_connection
from .tools import embed_texto

ROLES_VALIDOS = ("VENDEDOR", "GERENCIA", "ADMIN")


class DocumentoError(Exception):
    pass


def _validar_roles(roles_visibles: list[str] | None) -> list[str]:
    if not roles_visibles:
        return list(ROLES_VALIDOS)
    invalidos = [r for r in roles_visibles if r not in ROLES_VALIDOS]
    if invalidos:
        raise DocumentoError(f"Rol(es) inválido(s): {', '.join(invalidos)}.")
    return roles_visibles


def _insertar_chunks(conn, documento_id: int, contenido: str) -> int:
    """Trocea, embebe (input_type='passage', ver tools.py) e inserta -- se
    llama tanto en la creación como después de borrar los chunks viejos en
    una edición, nunca se agrega sin haber borrado primero."""
    fragmentos = chunear(contenido)
    for indice, fragmento in enumerate(fragmentos):
        embedding = embed_texto(fragmento, input_type="passage")
        conn.execute(
            """
            INSERT INTO rag.chunk (documento_id, chunk_index, contenido, embedding)
            VALUES (%s, %s, %s, %s::vector)
            """,
            (documento_id, indice, fragmento, embedding),
        )
    return len(fragmentos)


def crear_documento(
    titulo: str,
    categoria: str,
    roles_visibles: list[str] | None,
    nombre_archivo: str,
    archivo_bytes: bytes,
    subido_por: str | None,
) -> dict:
    contenido = extraer_texto(nombre_archivo, archivo_bytes)
    roles = _validar_roles(roles_visibles)
    formato = nombre_archivo.rsplit(".", 1)[-1].lower() if "." in nombre_archivo else "txt"

    with get_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO rag.documento (titulo, categoria, contenido, formato_original, roles_visibles, subido_por)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, titulo, categoria, formato_original, roles_visibles, subido_por, activo, fecha_creacion, fecha_actualizacion
            """,
            (titulo, categoria, contenido, formato, roles, subido_por),
        )
        documento = cur.fetchone()
        num_chunks = _insertar_chunks(conn, documento["id"], contenido)
        conn.commit()

    return {**documento, "num_chunks": num_chunks}


def actualizar_documento(
    documento_id: int,
    titulo: str | None,
    categoria: str | None,
    roles_visibles: list[str] | None,
    nombre_archivo: str | None,
    archivo_bytes: bytes | None,
    subido_por: str | None,
) -> dict:
    with get_connection() as conn:
        existente = conn.execute(
            "SELECT id, contenido, formato_original FROM rag.documento WHERE id = %s AND activo", (documento_id,)
        ).fetchone()
        if not existente:
            raise DocumentoError(f"Documento {documento_id} no encontrado o inactivo.")

        contenido = existente["contenido"]
        formato = existente["formato_original"]
        hay_archivo_nuevo = archivo_bytes is not None and nombre_archivo is not None
        if hay_archivo_nuevo:
            contenido = extraer_texto(nombre_archivo, archivo_bytes)
            formato = nombre_archivo.rsplit(".", 1)[-1].lower() if "." in nombre_archivo else formato

        campos = {"contenido": contenido, "formato_original": formato, "subido_por": subido_por}
        if titulo is not None:
            campos["titulo"] = titulo
        if categoria is not None:
            campos["categoria"] = categoria
        if roles_visibles is not None:
            campos["roles_visibles"] = _validar_roles(roles_visibles)

        set_clause = ", ".join(f"{k} = %s" for k in campos) + ", fecha_actualizacion = now()"
        cur = conn.execute(
            f"""
            UPDATE rag.documento SET {set_clause} WHERE id = %s
            RETURNING id, titulo, categoria, formato_original, roles_visibles, subido_por, activo, fecha_creacion, fecha_actualizacion
            """,
            (*campos.values(), documento_id),
        )
        documento = cur.fetchone()

        num_chunks = None
        if hay_archivo_nuevo:
            # Nunca agregar sin borrar -- ver comentario en schema-rag.sql:
            # una versión vieja del documento no debe seguir compitiendo en
            # la búsqueda junto a la nueva.
            conn.execute("DELETE FROM rag.chunk WHERE documento_id = %s", (documento_id,))
            num_chunks = _insertar_chunks(conn, documento_id, contenido)
        conn.commit()

    return {**documento, "num_chunks": num_chunks}


_LARGO_RESUMEN = 220


def listar_documentos() -> list[dict]:
    """`resumen` es un extracto de `contenido` calculado en SQL -- el
    listado no trae el contenido completo (evita un payload pesado con
    muchos documentos), pero la UI (document-explorer) sí necesita un texto
    corto por tarjeta, ver gerencia-data.service.ts."""
    with get_connection() as conn:
        cur = conn.execute(
            f"""
            SELECT id, titulo, categoria, formato_original, roles_visibles, subido_por, activo,
                   fecha_creacion, fecha_actualizacion, LEFT(contenido, {_LARGO_RESUMEN}) AS resumen
            FROM rag.documento
            WHERE activo
            ORDER BY fecha_actualizacion DESC
            """
        )
        return cur.fetchall()


def obtener_documento(documento_id: int) -> dict:
    with get_connection() as conn:
        fila = conn.execute(
            f"""
            SELECT id, titulo, categoria, contenido, formato_original, roles_visibles, subido_por, activo,
                   fecha_creacion, fecha_actualizacion, LEFT(contenido, {_LARGO_RESUMEN}) AS resumen
            FROM rag.documento
            WHERE id = %s AND activo
            """,
            (documento_id,),
        ).fetchone()
        if not fila:
            raise DocumentoError(f"Documento {documento_id} no encontrado o inactivo.")
        return fila


def desactivar_documento(documento_id: int) -> None:
    """Soft-delete: nunca se borra físicamente (mismo criterio que
    usuarios.activo en backend/admin) -- deja de verse en listar_documentos
    y en la búsqueda del chat (rag.v_chunk_visible filtra por d.activo)."""
    with get_connection() as conn:
        cur = conn.execute(
            "UPDATE rag.documento SET activo = false, fecha_actualizacion = now() WHERE id = %s AND activo",
            (documento_id,),
        )
        if cur.rowcount == 0:
            raise DocumentoError(f"Documento {documento_id} no encontrado o ya inactivo.")
        conn.commit()
