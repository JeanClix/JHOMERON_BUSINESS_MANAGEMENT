package com.jhomeron.batch.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Modelo de datos que representa una línea de venta extraída de SAP Business One / SQL Server
 * a través del Stored Procedure dbo.SP_EXTRAER_VENTAS.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VentaDTO {

    // Identificador para base staging (opcional / autogenerado)
    private Long id;

    // Campos del Stored Procedure dbo.sp_ExtraerVentas
    private LocalDate fechaContabilizacion;
    private LocalDate fechaDocumento;
    private LocalDate fechaVencimiento;
    private String tipo;
    private String serie;
    private Integer numero;
    private String ruc;
    private String razonSocial;
    private String empleadoVenta;
    private String numeroArticulo;
    private String descripcionArticulo;
    private String unidadMedida;
    private BigDecimal cantidad;
    private BigDecimal valorUnitario;
    private BigDecimal totalVentaMe;
    private String moneda;
    private BigDecimal tipoCambio;
    private BigDecimal totalVentaMn;
    private String ciudad;
    private String distrito;
    private String departamento;

    // Metadatos para pipeline ETL / Staging
    private LocalDateTime fechaCarga;
    private String source;
    private String lote;
    private String estado;
}
