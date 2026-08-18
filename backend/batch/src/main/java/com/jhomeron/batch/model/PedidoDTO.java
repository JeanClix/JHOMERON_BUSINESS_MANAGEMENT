package com.jhomeron.batch.model;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Modelo de datos que representa un pedido de un cliente.
 *
 * ORIGEN:
 *   - CSV (modo dev):  se extrae desde pedidos_ejemplo.csv
 *   - SAP (modo prod): se extrae desde SP_OBTENER_PEDIDOS en HANA
 *
 * CAMPOS (3-4 campos segun lo indicado):
 *   - cliente:     Nombre/codigo del cliente que pide pintura
 *   - producto:    Nombre/codigo del producto (ej: "PINTURA LATEX BLANCO 20L")
 *   - cantidad:    Cantidad pedida en unidades
 *   - fechaPedido: Fecha en que se realizo el pedido
 *
 * CAMPOS METADATA (agregados por el processor):
 *   - fechaCarga:  Fecha/hora en que se cargo el registro al staging
 *   - source:      Origen del dato ("SAP" o "CSV")
 *   - lote:        Identificador del lote de carga batch
 *   - estado:      Estado en el pipeline ("PENDIENTE", "PROCESADO", "ERROR")
 *
 * USO EN EL FLUJO ETL:
 *   Reader (convierte fila a PedidoDTO)
 *   --> Processor (valida y transforma PedidoDTO)
 *   --> Writer (inserta PedidoDTO en staging.pedidos)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PedidoDTO {

    private Long id;

    @NotBlank(message = "El cliente es obligatorio")
    private String cliente;

    @NotBlank(message = "El producto es obligatorio")
    private String producto;

    @NotNull(message = "La cantidad es obligatoria")
    @Min(value = 1, message = "La cantidad debe ser mayor a 0")
    private Integer cantidad;

    @NotNull(message = "La fecha del pedido es obligatoria")
    private LocalDate fechaPedido;

    private LocalDateTime fechaCarga;

    @NotBlank(message = "El source es obligatorio")
    private String source;

    private String lote;

    private String estado;
}
