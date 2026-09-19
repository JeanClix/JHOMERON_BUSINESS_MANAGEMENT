package com.jhomeron.admin.controller;

import com.jhomeron.admin.model.User;
import com.jhomeron.admin.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * CRUD real de usuarios para el panel de administración. Reemplaza el
 * endpoint auto-generado de Spring Data REST (desactivado en
 * UserRepository) porque ese endpoint guardaba/exponía la contraseña en
 * texto plano -- aquí se hashea con bcrypt antes de persistir y nunca se
 * devuelve en las respuestas.
 */
@RestController
@RequestMapping("/api/admin/users")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @GetMapping
    public List<Map<String, Object>> listar() {
        return userRepository.findAll().stream().map(this::aRespuesta).toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> obtener(@PathVariable Long id) {
        return userRepository.findById(id)
                .map(u -> ResponseEntity.ok(aRespuesta(u)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Usuario no encontrado")));
    }

    @PostMapping
    public ResponseEntity<?> crear(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");
        String name = body.get("name");
        String role = body.get("role");

        if (username == null || username.isBlank() || password == null || password.isBlank()
                || name == null || name.isBlank() || role == null || role.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "username, password, name y role son obligatorios"));
        }
        if (userRepository.findByUsername(username) != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Ya existe un usuario con ese nombre de usuario"));
        }

        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setName(name);
        user.setRole(role.toUpperCase());
        user.setDescription(body.get("description"));
        user.setArea(body.get("area"));
        user.setLocation(body.get("location"));
        user.setActivo(true); // todo usuario nuevo arranca activo
        aplicarCamposVendedor(user, body);

        User guardado = userRepository.save(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(aRespuesta(guardado));
    }

    /**
     * Actualiza meta_mensual y/o meta_semanal para TODOS los usuarios con
     * role=VENDEDOR de una sola vez. Existe porque hoy la meta es la misma
     * para todo el equipo -- sin esto, subir o bajar la meta general
     * significaba editar vendedor por vendedor a mano.
     */
    @PutMapping("/meta-vendedores")
    public ResponseEntity<?> actualizarMetaVendedores(@RequestBody Map<String, String> body) {
        String metaMensualRaw = body.get("metaMensual");
        String metaSemanalRaw = body.get("metaSemanal");
        boolean sinMensual = metaMensualRaw == null || metaMensualRaw.isBlank();
        boolean sinSemanal = metaSemanalRaw == null || metaSemanalRaw.isBlank();
        if (sinMensual && sinSemanal) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Debes indicar metaMensual y/o metaSemanal"));
        }

        List<User> vendedores = userRepository.findByRole("VENDEDOR");
        for (User v : vendedores) {
            if (!sinMensual) v.setMetaMensual(new BigDecimal(metaMensualRaw));
            if (!sinSemanal) v.setMetaSemanal(new BigDecimal(metaSemanalRaw));
        }
        userRepository.saveAll(vendedores);

        return ResponseEntity.ok(Map.of("vendedoresActualizados", vendedores.size()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return userRepository.findById(id).map(user -> {
            if (body.get("name") != null) user.setName(body.get("name"));
            if (body.get("role") != null) user.setRole(body.get("role").toUpperCase());
            if (body.get("description") != null) user.setDescription(body.get("description"));
            if (body.get("area") != null) user.setArea(body.get("area"));
            if (body.get("location") != null) user.setLocation(body.get("location"));
            if (body.get("activo") != null) user.setActivo(Boolean.parseBoolean(body.get("activo")));
            aplicarCamposVendedor(user, body);
            // Solo re-hashear si mandan una contraseña nueva (no vaciar la existente)
            if (body.get("password") != null && !body.get("password").isBlank()) {
                user.setPassword(passwordEncoder.encode(body.get("password")));
            }
            User guardado = userRepository.save(user);
            return ResponseEntity.ok(aRespuesta(guardado));
        }).orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Usuario no encontrado")));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Long id) {
        if (!userRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Usuario no encontrado"));
        }
        userRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> aRespuesta(User user) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", user.getId());
        m.put("username", user.getUsername());
        m.put("name", user.getName());
        m.put("description", user.getDescription());
        m.put("area", user.getArea());
        m.put("location", user.getLocation());
        m.put("role", user.getRole());
        m.put("activo", user.getActivo());
        m.put("metaMensual", user.getMetaMensual());
        m.put("metaSemanal", user.getMetaSemanal());
        m.put("vendedorNombreSap", user.getVendedorNombreSap());
        return m;
    }

    /**
     * Campos que solo tienen sentido para rol VENDEDOR. metaMensual/metaSemanal
     * llegan como string desde el body (Map<String,String>, igual que el
     * resto de este controller) y se parsean a BigDecimal a mano.
     *
     * vendedorNombreSap es deuda tecnica temporal (ver User.java): debe
     * copiarse EXACTO desde dwh.dim_vendedor.empleado_venta -- quien crea el
     * vendedor en el panel admin es responsable de que coincida, hasta que
     * el batch extraiga un codigo de vendedor estable de SAP.
     */
    private void aplicarCamposVendedor(User user, Map<String, String> body) {
        if (body.containsKey("metaMensual")) {
            String raw = body.get("metaMensual");
            user.setMetaMensual(raw == null || raw.isBlank() ? null : new BigDecimal(raw));
        }
        if (body.containsKey("metaSemanal")) {
            String raw = body.get("metaSemanal");
            user.setMetaSemanal(raw == null || raw.isBlank() ? null : new BigDecimal(raw));
        }
        if (body.containsKey("vendedorNombreSap")) {
            String raw = body.get("vendedorNombreSap");
            user.setVendedorNombreSap(raw == null || raw.isBlank() ? null : raw.trim());
        }
    }
}
