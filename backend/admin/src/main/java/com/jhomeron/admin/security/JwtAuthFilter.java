package com.jhomeron.admin.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filtro liviano (no trae Spring Security completo, ver comentario en
 * pom.xml) que exige un JWT valido para /api/admin/** -- la gestion de
 * usuarios/vendedores solo la puede tocar un rol ADMIN. /api/auth/** queda
 * abierto (es donde se obtiene el token) y todo lo demas pasa sin exigir
 * token porque hoy no expone datos sensibles fuera de /api/admin.
 *
 * Los claims validados quedan en el request attribute "jwtClaims" por si un
 * controller los necesita mas adelante.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.startsWith("/api/admin/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Falta token Bearer");
            return;
        }

        try {
            Claims claims = jwtService.validar(header.substring("Bearer ".length()));
            String role = claims.get("role", String.class);
            if (!"ADMIN".equalsIgnoreCase(role)) {
                response.sendError(HttpServletResponse.SC_FORBIDDEN, "Requiere rol ADMIN");
                return;
            }
            request.setAttribute("jwtClaims", claims);
        } catch (JwtException | IllegalArgumentException ex) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Token invalido o expirado");
            return;
        }

        chain.doFilter(request, response);
    }
}
