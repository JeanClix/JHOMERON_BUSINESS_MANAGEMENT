/**
 * Formas de respuesta de backend/reporting (ver backend/reporting/README.md).
 * Endpoints de /vendedores/me/* -- el vendedor siempre se resuelve del JWT
 * en el backend, nunca se manda desde acá.
 */

export interface CuotaVendedor {
  vendedor: string;
  modo: PeriodoModo;
  anio: number;
  mes: number;
  anio_iso: number;
  semana_iso: number;
  meta_mensual: number | null;
  meta_semanal: number | null;
  // meta_mensual o meta_semanal segun `modo` -- la que el backend realmente
  // usó para calcular porcentaje_cumplimiento. Son metas independientes,
  // no una derivada de la otra (ver User.java del lado de admin).
  meta_aplicada: number | null;
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

/**
 * Endpoints de /gerencia/* -- agregados a nivel empresa, sin filtro por
 * vendedor. Requieren JWT con role=GERENCIA o ADMIN (ver
 * backend/reporting/src/auth.py:require_gerencia).
 */

export interface ClienteTopGerencia {
  cliente: string;
  departamento: string;
  productos_distintos: number;
  total_soles: number;
}

export interface TopClientesGerenciaResponse {
  anio: number;
  mes: number;
  clientes: ClienteTopGerencia[];
}

export interface ProductoGerencia {
  codigo_producto: string;
  producto: string;
  total_soles: number;
  cantidad: number;
}

export interface TopProductosGerenciaResponse {
  anio: number;
  mes: number;
  orden: 'asc' | 'desc';
  productos: ProductoGerencia[];
}

export interface TicketPromedioResponse {
  anio: number;
  mes: number;
  ticket_promedio: number | null;
  clientes_activos: number;
}

export interface VentasMes {
  mes: number;
  total_soles: number;
  numero_lineas: number;
}

export interface TendenciaVentasResponse {
  anio: number;
  meses: VentasMes[];
}

export interface DepartamentoVentas {
  departamento: string;
  total_soles: number;
  numero_lineas: number;
  clientes_distintos: number;
}

export interface MapaDepartamentosResponse {
  anio: number;
  mes: number | null;
  departamentos: DepartamentoVentas[];
}
