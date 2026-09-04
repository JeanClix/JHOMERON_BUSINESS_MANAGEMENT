# JHOMERON - Extracción de Ventas (SAP Business One / SQL Server)

## Consulta y Stored Procedure Real: `dbo.SP_EXTRAER_VENTAS`

Tablas SAP B1 usadas:
- `dbo.OINV` (T0): Cabecera de Facturas de Venta (A/R Invoice)
- `dbo.INV1` (T1): Detalle / Líneas de la Factura de Venta
- `dbo.OCRD` (T2): Maestro de Socios de Negocio (Clientes)
- `dbo.CRD1` (T3): Direcciones fiscales del Socio de Negocio (`AdresType = 'B'`)
- `dbo.OSLP` (T4): Maestro de Vendedores (Sales Employees)
- `dbo.OCTG` (T5): Condiciones de Pago (Payment Terms)
- `dbo.OITM` (T6): Maestro de Artículos (Items)
- `dbo.OITB` (T7): Familias / Grupos de Artículos (Categorías)

### Definición del Stored Procedure en SQL Server:

```sql
USE Jhomeron;
GO

CREATE OR ALTER PROCEDURE dbo.SP_EXTRAER_VENTAS
    @FechaDesde DATE,
    @FechaHasta DATE
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        T0.DocEntry                AS DocEntry,
        T1.LineNum                 AS DocLine,
        T0.DocDate                 AS Fecha,
        T2.CardCode                AS CodigoCliente,
        T2.CardName                AS Cliente,
        T3.State                   AS Departamento,
        T3.City                    AS Provincia,
        T3.County                  AS Distrito,
        T4.SlpCode                 AS CodigoVendedor,
        T4.SlpName                 AS Vendedor,
        T6.ItemCode                AS CodigoProducto,
        T6.ItemName                AS Producto,
        T7.ItmsGrpNam              AS Categoria,
        T5.PymntGroup              AS CondicionPago,
        T1.Quantity                AS Cantidad,
        T1.Price                   AS PrecioUnitario,
        T1.LineTotal               AS BaseImponible,
        T0.DocTotal                AS ImporteTotal,
        T0.VatSum                  AS IGV
    FROM dbo.OINV T0
    INNER JOIN dbo.INV1 T1 ON T0.DocEntry = T1.DocEntry
    INNER JOIN dbo.OCRD T2 ON T2.CardCode = T0.CardCode
    INNER JOIN dbo.CRD1 T3 ON T3.CardCode = T0.CardCode AND T3.AdresType = 'B'
    INNER JOIN dbo.OSLP T4 ON T4.SlpCode = T0.SlpCode
    INNER JOIN dbo.OCTG T5 ON T5.GroupNum = T0.GroupNum
    INNER JOIN dbo.OITM T6 ON T6.ItemCode = T1.ItemCode
    INNER JOIN dbo.OITB T7 ON T7.ItmsGrpCod = T6.ItmsGrpCod
    WHERE T0.DocDate BETWEEN @FechaDesde AND @FechaHasta
      AND T0.CANCELED = 'N'
    ORDER BY T0.DocDate, T0.DocEntry, T1.LineNum;
END
GO
```

### Columnas y Mapeo con Java (`VentaDTO`):

| Columna SP | Origen SAP B1 | Tipo SQL | Campo Java (`VentaDTO`) | Tipo Java |
| :--- | :--- | :--- | :--- | :--- |
| `DocEntry` | `T0.DocEntry` | `INT` | `docEntry` | `Integer` |
| `DocLine` | `T1.LineNum` | `INT` | `docLine` | `Integer` |
| `Fecha` | `T0.DocDate` | `DATE` | `fecha` | `LocalDate` |
| `CodigoCliente` | `T2.CardCode` | `VARCHAR` | `codigoCliente` | `String` |
| `Cliente` | `T2.CardName` | `VARCHAR` | `cliente` | `String` |
| `Departamento` | `T3.State` | `VARCHAR` | `departamento` | `String` |
| `Provincia` | `T3.City` | `VARCHAR` | `provincia` | `String` |
| `Distrito` | `T3.County` | `VARCHAR` | `distrito` | `String` |
| `CodigoVendedor` | `T4.SlpCode` | `INT` | `codigoVendedor` | `Integer` |
| `Vendedor` | `T4.SlpName` | `VARCHAR` | `vendedor` | `String` |
| `CodigoProducto` | `T6.ItemCode` | `VARCHAR` | `codigoProducto` | `String` |
| `Producto` | `T6.ItemName` | `VARCHAR` | `producto` | `String` |
| `Categoria` | `T7.ItmsGrpNam` | `VARCHAR` | `categoria` | `String` |
| `CondicionPago` | `T5.PymntGroup` | `VARCHAR` | `condicionPago` | `String` |
| `Cantidad` | `T1.Quantity` | `NUMERIC(19,6)` | `cantidad` | `BigDecimal` |
| `PrecioUnitario` | `T1.Price` | `NUMERIC(19,6)` | `precioUnitario` | `BigDecimal` |
| `BaseImponible` | `T1.LineTotal` | `NUMERIC(19,6)` | `baseImponible` | `BigDecimal` |
| `ImporteTotal` | `T0.DocTotal` | `NUMERIC(19,6)` | `importeTotal` | `BigDecimal` |
| `IGV` | `T0.VatSum` | `NUMERIC(19,6)` | `igv` | `BigDecimal` |