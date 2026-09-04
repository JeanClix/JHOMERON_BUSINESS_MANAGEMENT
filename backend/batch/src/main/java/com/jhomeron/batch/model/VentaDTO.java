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

    // Campos del Stored Procedure dbo.SP_EXTRAER_VENTAS
    private Integer docEntry;
    private Integer docLine;
    private LocalDate fecha;
    private String codigoCliente;
    private String cliente;
    private String departamento;
    private String provincia;
    private String distrito;
    private Integer codigoVendedor;
    private String vendedor;
    private String codigoProducto;
    private String producto;
    private String categoria;
    private String condicionPago;
    private BigDecimal cantidad;
    private BigDecimal precioUnitario;
    private BigDecimal baseImponible;
    private BigDecimal importeTotal;
    private BigDecimal igv;

    // Metadatos para pipeline ETL / Staging
    private LocalDateTime fechaCarga;
    private String source;
    private String lote;
    private String estado;

    // Métodos de compatibilidad con versiones anteriores
    public LocalDate getDocDate() {
        return fecha;
    }

    public String getCardCode() {
        return codigoCliente;
    }

    public String getCardName() {
        return cliente;
    }

    public String getItemCode() {
        return codigoProducto;
    }

    public String getItemName() {
        return producto;
    }

    public Integer getSlpCode() {
        return codigoVendedor;
    }

    public String getSlpName() {
        return vendedor;
    }

    public BigDecimal getQuantity() {
        return cantidad;
    }

    public BigDecimal getUnitPrice() {
        return precioUnitario;
    }

    public BigDecimal getLineTotal() {
        return baseImponible;
    }
}
