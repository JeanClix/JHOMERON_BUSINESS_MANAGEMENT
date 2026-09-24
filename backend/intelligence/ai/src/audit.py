"""Auditoria: registra cada pregunta/respuesta en ai.consulta_log para poder
responder "de qué datos reales provino esta respuesta" (trazabilidad)."""
from .db import get_connection


def registrar_consulta(
    pregunta_usuario: str,
    vendedor: str | None,
    sql_generado: str | None,
    filas_retornadas: int | None,
    respuesta_llm: str | None,
    modelo: str,
    exito: bool,
    error: str | None,
    duracion_ms: int,
    usuario: str | None = None,
    rol: str | None = None,
    tokens_entrada: int | None = None,
    tokens_salida: int | None = None,
) -> None:
    """`usuario`/`rol` vienen de los claims `sub`/`role` del JWT -- el panel
    de Admin (ConsumoIaController en backend/admin) los usa para mostrar
    quién hizo cada pregunta y cuántos tokens gastó."""
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO ai.consulta_log
                (pregunta_usuario, vendedor, sql_generado, filas_retornadas, respuesta_llm,
                 modelo, exito, error, duracion_ms, usuario, rol, tokens_entrada, tokens_salida)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (pregunta_usuario, vendedor, sql_generado, filas_retornadas, respuesta_llm,
             modelo, exito, error, duracion_ms, usuario, rol, tokens_entrada, tokens_salida),
        )
        conn.commit()
