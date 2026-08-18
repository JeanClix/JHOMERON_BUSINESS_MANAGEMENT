package com.jhomeron.batch.processor;

import com.jhomeron.batch.model.PedidoDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.infrastructure.item.ItemProcessor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Processor del batch ETL: valida y transforma cada pedido antes de escribirlo.
 *
 * FLUJO:
 *   Reader (CSV/SAP) --> *** PROCESSOR *** --> Writer (PostgreSQL/H2)
 *
 * QUE HACE:
 *   1. Valida que los campos obligatorios no esten vacios
 *   2. Limpia y normaliza los datos (trim, uppercase)
 *   3. Agrega metadatos: fecha de carga, lote, estado
 *   4. Retorna null si el registro es invalido (se descarta)
 *
 * REGLAS DE VALIDACION:
 *   - cliente:   obligatorio, no vacio
 *   - producto:  obligatorio, no vacio
 *   - cantidad:  obligatoria, mayor a 0
 *   - Si algun campo falla, el registro se descarta (se retorna null)
 *
 * TRANSFORMACIONES:
 *   - cliente y producto -> trim + uppercase
 *   - fechaCarga -> fecha/hora actual del servidor
 *   - lote -> "BATCH_yyyyMMdd_HHmmss"
 *   - estado -> "PENDIENTE"
 */
@Component
public class PedidoProcessor implements ItemProcessor<PedidoDTO, PedidoDTO> {

    private static final Logger log = LoggerFactory.getLogger(PedidoProcessor.class);

    @Override
    public PedidoDTO process(PedidoDTO item) throws Exception {
        log.debug("Procesando pedido: cliente={}, producto={}, cantidad={}",
                item.getCliente(), item.getProducto(), item.getCantidad());

        // Validar cliente
        if (item.getCliente() == null || item.getCliente().isBlank()) {
            log.warn("Pedido ignorado: cliente vacio");
            return null;
        }

        // Validar producto
        if (item.getProducto() == null || item.getProducto().isBlank()) {
            log.warn("Pedido ignorado: producto vacio para cliente {}", item.getCliente());
            return null;
        }

        // Validar cantidad
        if (item.getCantidad() == null || item.getCantidad() <= 0) {
            log.warn("Pedido ignorado: cantidad invalida {} para cliente {}",
                    item.getCantidad(), item.getCliente());
            return null;
        }

        // Normalizar strings
        item.setCliente(item.getCliente().trim().toUpperCase());
        item.setProducto(item.getProducto().trim().toUpperCase());

        // Agregar metadatos
        item.setFechaCarga(LocalDateTime.now());
        item.setEstado("PENDIENTE");

        if (item.getLote() == null) {
            item.setLote("BATCH_" + LocalDateTime.now().format(
                    java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")));
        }

        log.debug("Pedido procesado exitosamente: {}", item);
        return item;
    }
}
