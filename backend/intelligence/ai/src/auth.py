"""Validacion del JWT emitido por backend/admin -- mismo criterio que
backend/reporting/src/auth.py. No es una fuente de verdad compartida entre
servicios (cada uno valida el token de forma independiente contra el mismo
secreto), es deliberado: este servicio no depende de que reporting este
arriba para saber "quien pregunta".

Solo lo usa /recomendaciones/reactivacion -- /chat sigue sin auth (fuera de
alcance de esta iteracion, ver README).
"""
from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException, status

from .config import settings


def get_bearer_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Falta token Bearer")
    return authorization.removeprefix("Bearer ").strip()


def get_current_claims(token: str = Depends(get_bearer_token)) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Token invalido o expirado: {e}")


def require_vendedor(claims: dict = Depends(get_current_claims)) -> str:
    """Devuelve el vendedor_nombre_sap del vendedor autenticado -- nunca se
    lee de un query param, mismo criterio que en reporting."""
    if claims.get("role") != "VENDEDOR":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requiere rol VENDEDOR")
    vendedor = claims.get("vendedorNombreSap")
    if not vendedor:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Este usuario no tiene vendedor_nombre_sap configurado en el panel admin.",
        )
    return vendedor
