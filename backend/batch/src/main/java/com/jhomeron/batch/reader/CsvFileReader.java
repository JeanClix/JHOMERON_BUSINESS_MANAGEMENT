package com.jhomeron.batch.reader;

import com.jhomeron.batch.model.PedidoDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.infrastructure.item.file.FlatFileItemReader;
import org.springframework.batch.infrastructure.item.file.builder.FlatFileItemReaderBuilder;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Reader para modo DEV: lee pedidos desde un archivo CSV.
 *
 * FORMATO ESPERADO DEL CSV:
 *   cliente,producto,cantidad,fechaPedido
 *   CONSTRUCTORA DEL NORTE,PINTURA LATEX BLANCO 20L,50,2026-08-01
 *   PINTURAS ALTO VALOR,PINTURA SINTETICA ROJO 10L,30,2026-08-02
 *
 * MAPEO DE COLUMNAS:
 *   Columna 0 -> cliente
 *   Columna 1 -> producto
 *   Columna 2 -> cantidad (entero)
 *   Columna 3 -> fechaPedido (formato yyyy-MM-dd)
 *
 * CONFIGURACION:
 *   El archivo CSV se ubica en: src/main/resources/data/pedidos_ejemplo.csv
 *   La ruta se configura en: batch.csv.path (application.yaml)
 *
 * NOTA: En modo prod se usa SapHanaReader en su lugar.
 */
@Component
public class CsvFileReader {

    private static final Logger log = LoggerFactory.getLogger(CsvFileReader.class);
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /**
     * Crea un FlatFileItemReader que lee el CSV de pedidos.
     * Se usa internamente por el Job de Spring Batch en perfil dev.
     */
    public FlatFileItemReader<PedidoDTO> reader() {
        log.info("Configurando FlatFileItemReader para CSV de pedidos");

        return new FlatFileItemReaderBuilder<PedidoDTO>()
                .name("csvPedidoReader")
                .resource(new ClassPathResource("data/pedidos_ejemplo.csv"))
                .linesToSkip(1) // Saltar header del CSV
                .delimited()
                .delimiter(",")
                .names("cliente", "producto", "cantidad", "fechaPedido")
                .fieldSetMapper(fieldSet -> {
                    PedidoDTO pedido = new PedidoDTO();
                    pedido.setCliente(fieldSet.readString("cliente"));
                    pedido.setProducto(fieldSet.readString("producto"));
                    pedido.setCantidad(fieldSet.readInt("cantidad"));
                    pedido.setFechaPedido(LocalDate.parse(fieldSet.readString("fechaPedido"), DATE_FORMAT));
                    pedido.setSource("CSV"); // Marcar origen como CSV
                    return pedido;
                })
                .build();
    }
}
