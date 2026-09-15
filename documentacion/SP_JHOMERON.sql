-- =========================================================
-- STORED PROCEDURE: sp_ExtraerVentas
-- Base: jhomeron (espejo de SAP B1 / HANA)
--
-- Replica el reporte real de ventas de la empresa (UNION ALL
-- de Facturas/Boletas [OINV], Entregas [ODPI] y Notas de
-- Credito/Debito [ORIN]), agregando las 3 columnas de
-- ubicacion (Ciudad, Distrito, Departamento) via CRD1.
--
-- Este es el UNICO objeto al que el usuario restringido de
-- Tailscale (usado por el ETL Spring Batch) tiene permiso
-- de EXECUTE. No tiene SELECT directo sobre las tablas base.
-- =========================================================

USE jhomeron;
GO

IF OBJECT_ID('dbo.sp_ExtraerVentas', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ExtraerVentas;
GO

CREATE PROCEDURE dbo.sp_ExtraerVentas
    @FechaInicio DATE,
    @FechaFin    DATE
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        T0.DocDate                 AS [FECHA DE CONTABILIZACION],
        T0.TaxDate                 AS [FECHA DE DOCUMENTO],
        T0.DocDueDate              AS [FECHA DE VENCIMIENTO],
        T0.Indicator               AS [TIPO],
        T0.FolioPref               AS [SERIE],
        T0.FolioNum                AS [NUMERO],
        T0.LicTradNum              AS [RUC],
        T0.CardName                AS [RAZON SOCIAL],
        T7.SlpName                 AS [empleado de venta],
        T1.ItemCode                AS [NUMERO DE ARTICULO],
        T1.Dscription              AS [DESCRIPCION DEL ARTICULO],
        T1.unitMsr                 AS [UNIDAD DE MEDIDA],
        T1.Quantity                AS [CANTIDAD],
        T1.PriceBefDi              AS [VALOR UNITARIO],
        T1.TotalFrgn               AS [TOTAL V. VENTA ME],
        T0.DocCur                  AS [MONEDA],
        T0.DocRate                 AS [T.C.],
        T1.LineTotal               AS [TOTAL V. VENTA MN],
        T8.City                    AS [CIUDAD],
        T8.County                  AS [DISTRITO],
        T8.State                   AS [DEPARTAMENTO]
    FROM OINV T0
    INNER JOIN INV1 T1 ON T0.DocEntry = T1.DocEntry
    LEFT JOIN OSLP T7 ON T7.SlpCode = T0.SlpCode
    LEFT JOIN CRD1 T8 ON T8.CardCode = T0.CardCode AND T8.Address = T0.Address2
    WHERE T0.DocDate BETWEEN @FechaInicio AND @FechaFin
      AND T0.FolioNum <> 0
      AND T0.FolioPref <> 'LT'
      AND T0.U_OK1_Anulada = 'N'

    UNION ALL

    SELECT
        T3.DocDate,
        T3.TaxDate,
        T3.DocDueDate,
        T3.Indicator,
        T3.FolioPref,
        T3.FolioNum,
        T3.LicTradNum,
        T3.CardName,
        T7.SlpName,
        T4.ItemCode,
        T4.Dscription,
        T4.unitMsr,
        T4.Quantity,
        T4.PriceBefDi,
        T4.TotalFrgn,
        T3.DocCur,
        T3.DocRate,
        T4.LineTotal,
        T8.City,
        T8.County,
        T8.State
    FROM ODPI T3
    INNER JOIN DPI1 T4 ON T3.DocEntry = T4.DocEntry
    LEFT JOIN OSLP T7 ON T7.SlpCode = T3.SlpCode
    LEFT JOIN CRD1 T8 ON T8.CardCode = T3.CardCode AND T8.Address = T3.Address2
    WHERE T3.DocDate BETWEEN @FechaInicio AND @FechaFin
      AND T3.FolioNum <> 0
      AND T3.FolioPref <> 'LT'
      AND T3.U_OK1_Anulada = 'N'

    UNION ALL

    SELECT
        T0.DocDate,
        T0.TaxDate,
        T0.DocDueDate,
        T0.Indicator,
        T0.FolioPref,
        T0.FolioNum,
        T0.LicTradNum,
        T0.CardName,
        T7.SlpName,
        T1.ItemCode,
        T1.Dscription,
        T1.unitMsr,
        T1.Quantity,
        T1.PriceBefDi,
        T1.TotalFrgn,
        T0.DocCur,
        T0.DocRate,
        T1.LineTotal,
        T8.City,
        T8.County,
        T8.State
    FROM ORIN T0
    INNER JOIN RIN1 T1 ON T0.DocEntry = T1.DocEntry
    LEFT JOIN OSLP T7 ON T7.SlpCode = T0.SlpCode
    LEFT JOIN CRD1 T8 ON T8.CardCode = T0.CardCode AND T8.Address = T0.Address2
    WHERE T0.DocDate BETWEEN @FechaInicio AND @FechaFin
      AND T0.FolioNum <> 0
      AND T0.FolioPref <> 'LT'
      AND T0.U_OK1_Anulada = 'N';
END
GO

-- =========================================================
-- PRUEBA RAPIDA (ajusta las fechas a tu gusto)
-- =========================================================
EXEC dbo.sp_ExtraerVentas @FechaInicio = '2026-01-01', @FechaFin = '2026-01-31';

-- =========================================================
-- PERMISOS PARA EL USUARIO RESTRINGIDO (Tailscale / Spring Batch)
-- Ajusta 'usuario_etl' al login real que crees para tu companero.
-- Este usuario NO debe tener SELECT directo sobre las tablas,
-- solo EXECUTE sobre este procedimiento.
-- =========================================================
-- CREATE LOGIN usuario_etl WITH PASSWORD = 'CambiaEstaClave123!';
-- CREATE USER usuario_etl FOR LOGIN usuario_etl;
-- GRANT EXECUTE ON dbo.sp_ExtraerVentas TO usuario_etl;
-- DENY SELECT ON SCHEMA::dbo TO usuario_etl;

GRANT EXECUTE ON dbo.sp_ExtraerVentas TO amigo_etl;