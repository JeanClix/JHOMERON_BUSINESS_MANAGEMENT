package com.jhomeron.admin.security;

import com.jhomeron.admin.model.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Emite y valida el JWT de sesion. admin es la UNICA fuente de verdad de
 * identidad (ver AuthController): otros servicios (reporting, y a futuro
 * ai/ml) validan este mismo token con el secreto compartido en vez de
 * reimplementar login.
 *
 * Claims incluidos (ver tambien AuthController.login):
 *   sub                  -> username
 *   uid                  -> id numerico del usuario
 *   role                 -> 'ADMIN' | 'GERENCIA' | 'VENDEDOR'
 *   name                 -> nombre real de la persona (User.name), para que
 *                           un servicio downstream (ej. AI Service) pueda
 *                           saludarla por su nombre sin tener que resolverlo
 *                           el mismo -- nunca usarlo para autorizacion.
 *   vendedorNombreSap    -> solo si role=VENDEDOR (ver User.vendedorNombreSap
 *                           para la deuda tecnica de por que es un nombre y
 *                           no un codigo estable)
 *
 * IMPORTANTE: cualquier servicio que consuma este token debe leer el
 * vendedor SIEMPRE del claim, nunca de un parametro que mande el cliente --
 * es lo que garantiza que un vendedor no pueda pedir los datos de otro.
 */
@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMs;

    public JwtService(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration-ms}") long expirationMs
    ) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException(
                    "jwt.secret debe tener al menos 32 bytes (HS256). Configura JWT_SECRET.");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    public String generarToken(User user) {
        Date ahora = new Date();
        Date expira = new Date(ahora.getTime() + expirationMs);

        var builder = Jwts.builder()
                .subject(user.getUsername())
                .claim("uid", user.getId())
                .claim("role", user.getRole())
                .claim("name", user.getName())
                .issuedAt(ahora)
                .expiration(expira);

        if ("VENDEDOR".equalsIgnoreCase(user.getRole()) && user.getVendedorNombreSap() != null) {
            builder.claim("vendedorNombreSap", user.getVendedorNombreSap());
        }

        // Algoritmo explicito: sin esto, jjwt elige HS384/HS512 segun el largo
        // de la clave, que no coincide con JWT_ALGORITHM=HS256 fijo del lado
        // de reporting (Python) -- causa un 401 "alg not allowed" silencioso.
        return builder.signWith(key, Jwts.SIG.HS256).compact();
    }

    /** Lanza JwtException/IllegalArgumentException si el token es invalido o expiro. */
    public Claims validar(String token) throws JwtException {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
