"""Validacion del JWT emitido por backend/admin (ver
backend/admin/src/main/java/com/jhomeron/admin/security/JwtService.java).

Este servicio NUNCA emite tokens, solo los valida -- admin es la unica
fuente de verdad de identidad. Claims esperados: sub (username), uid, role
('ADMIN'|'GERENCIA'|'VENDEDOR'), y vendedorNombreSap (solo si role=VENDEDOR,
ver deuda tecnica en schema-admin.sql/schema-bi.sql).
"""
from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException, status

from .config import settings


def get_current_claims(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Falta token Bearer")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Token invalido o expirado: {e}")


def require_vendedor(claims: dict = Depends(get_current_claims)) -> str:
    """Devuelve el vendedor_nombre_sap del vendedor autenticado.

    Se lee SIEMPRE del JWT, nunca de un query param ni del body -- es lo
    unico que garantiza que un vendedor no pueda pedir los datos de otro
    (ver discusion de arquitectura: "no se podra ver las ventas de otro
    vendedor que no sea de su propia sesion").
    """
    if claims.get("role") != "VENDEDOR":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requiere rol VENDEDOR")

    vendedor = claims.get("vendedorNombreSap")
    if not vendedor:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Este usuario no tiene vendedor_nombre_sap configurado en el panel "
            "admin -- no se puede vincular con sus ventas en el Data Warehouse "
            "todavia (ver deuda tecnica en schema-admin.sql).",
        )
    return vendedor


def require_gerencia(claims: dict = Depends(get_current_claims)) -> dict:
    if claims.get("role") not in ("GERENCIA", "ADMIN"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requiere rol GERENCIA")
    return claims
