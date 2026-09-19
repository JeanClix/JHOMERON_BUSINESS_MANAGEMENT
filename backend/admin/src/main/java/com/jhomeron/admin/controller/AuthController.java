package com.jhomeron.admin.controller;

import com.jhomeron.admin.model.User;
import com.jhomeron.admin.repository.UserRepository;
import com.jhomeron.admin.security.JwtService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password");

        if (username == null || password == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Username and password required"));
        }

        User user = userRepository.findByUsername(username);

        if (user != null && passwordEncoder.matches(password, user.getPassword())) {
            // Nunca devolver el hash de la contraseña al frontend
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("id", user.getId());
            body.put("username", user.getUsername());
            body.put("name", user.getName());
            body.put("description", user.getDescription());
            body.put("area", user.getArea());
            body.put("location", user.getLocation());
            body.put("role", user.getRole());
            body.put("metaMensual", user.getMetaMensual());
            // Token de sesion: lo valida reporting (y a futuro ai/ml) para
            // saber quien pregunta sin volver a llamar a admin. El frontend
            // debe mandarlo como "Authorization: Bearer <token>" en cada
            // request a esos servicios.
            body.put("token", jwtService.generarToken(user));
            return ResponseEntity.ok(body);
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid credentials"));
    }
}
