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
    // "ciudad" y "departamento" quedan con el mismo valor (el nombre real,
    // ej. "LIMA") -- ver SqlServerVentaReader: antes "departamento" traia
    // por error el codigo de 3 letras (ej. "LIM") de SAP. Se mantienen AMBOS
    // campos (no se borra "ciudad") porque schema-ai.sql/schema-bi.sql ya
    // tienen vistas que leen c.ciudad.
    private String ciudad;
    private String distrito;
    private String departamento;
    private String provincia;
    // PRODUCTO / ACTIVO_FIJO / SERVICIO (ver OITM.TipoItem en la BD espejo y
    // sp_ExtraerVentas v2) -- fact_ventas solo promueve PRODUCTO, ver
    // schema-star.sql: ventas de vehiculos/activos de la empresa o
    // intereses no son ventas reales de pintura.
    private String tipoItem;

    // Metadatos para pipeline ETL / Staging
    private LocalDateTime fechaCarga;
    private String source;
    private String lote;
    private String estado;
}
