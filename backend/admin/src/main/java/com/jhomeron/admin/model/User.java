package com.jhomeron.admin.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(name = "usuarios")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario", unique = true, nullable = false, length = 100)
    private String username;

    @Column(name = "password", nullable = false)
    private String password;

    @Column(name = "nombre", nullable = false)
    private String name;

    @Column(name = "descripcion", columnDefinition = "TEXT")
    private String description;

    @Column(name = "area", length = 100)
    private String area;

    @Column(name = "ubicacion")
    private String location;

    @Column(name = "rol", nullable = false, length = 50)
    private String role; // 'ADMIN', 'GERENCIA', 'VENDEDOR'

    @Column(name = "meta_mensual", precision = 14, scale = 2)
    private BigDecimal metaMensual; // Solo aplica a rol VENDEDOR

    // DEUDA TECNICA TEMPORAL: unico join posible hoy entre este usuario y sus
    // ventas en dwh.fact_ventas (via dwh.dim_vendedor.empleado_venta), hasta
    // que el batch extraiga un codigo de vendedor estable (SlpCode) de SAP.
    // Debe copiarse exacto al crear el vendedor desde el panel admin.
    @Column(name = "vendedor_nombre_sap", length = 150)
    private String vendedorNombreSap;
}
