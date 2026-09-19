/**
 * Formas de respuesta de backend/reporting (ver backend/reporting/README.md).
 * Endpoints de /vendedores/me/* -- el vendedor siempre se resuelve del JWT
 * en el backend, nunca se manda desde acá.
 */

export interface CuotaVendedor {
  vendedor: string;
  anio: number;
  mes: number;
  meta_mensual: number | null;
  total_vendido: number;
  porcentaje_cumplimiento: number | null;
}

export interface VentaDia {
  fecha: string;
  dia_nombre: string;
  dia_semana: number;
  total_soles: number;
  cantidad: number;
}

export type PeriodoModo = 'mes' | 'semana';

export interface VentasPeriodoResponse {
  vendedor: string;
  modo: PeriodoModo;
  anio: number;
  mes: number;
  anio_iso: number;
  semana_iso: number;
  desde: string;
  hasta: string;
  dias: VentaDia[];
}

export interface ProductoVendedor {
  codigo_producto: string;
  producto: string;
  total_soles: number;
  cantidad: number;
}

export interface ProductosVendedorResponse {
  vendedor: string;
  anio: number;
  mes: number;
  orden: 'asc' | 'desc';
  productos: ProductoVendedor[];
}

export interface ClienteInactivo {
  cliente: string;
  ruc: string;
  departamento: string;
  ultima_compra: string;
  dias_desde_ultima_compra: number;
  compras_mes_actual: number;
  compras_anio_actual: number;
  total_soles_historico: number;
}

export interface ClientesInactivosResponse {
  vendedor: string;
  dias_umbral: number;
  clientes: ClienteInactivo[];
}
