import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { SidebarComponent } from '../../common/sidebar/sidebar.component';
import { SidebarItem } from '../../common/sidebar-item/sidebar-item.component';
import { VentasAiChatComponent } from './components/ventas-ai-chat/ventas-ai-chat.component';
import { BusinessChartComponent } from '../../shared/components/business-chart/business-chart.component';
import { AuthService } from '../../core/services/auth.service';
import { ReportingService } from '../../core/services/reporting.service';
import { BusinessChartData } from '../../core/models/chart.model';
import {
  ClienteInactivo,
  CuotaVendedor,
  PeriodoModo,
  ProductoVendedor,
  VentaDia
} from '../../core/models/reporting.model';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, SidebarComponent, VentasAiChatComponent, BusinessChartComponent],
  templateUrl: './ventas.component.html'
})
export class VentasComponent {
  private readonly authService = inject(AuthService);
  private readonly reportingService = inject(ReportingService);

  // Navigation & UI Signals
  protected readonly isSidebarCollapsed = signal<boolean>(false);
  protected readonly isMobileMenuOpen = signal<boolean>(false);

  // Sesión real del usuario logueado (ver core/services/auth.service.ts) --
  // reemplaza el "Juan Pérez" hardcodeado que había antes en el header.
  protected readonly currentUser = this.authService.currentUser;

  // Jhomeron Internal Sales Portal Modules. "Línea Marina" y "Generador de
  // Proformas" se sacaron del sidebar (no eran datos reales, ver README) --
  // el dashboard ahora conecta directo a backend/reporting.
  protected readonly sidebarItems = signal<SidebarItem[]>([
    {
      id: 'dashboard',
      label: 'Dashboard Ventas',
      subtitle: 'Resumen de metas y KPIs',
      description: 'Cumplimiento de cuota, ventas por período y tus clientes con más movimiento, con datos reales del Data Warehouse.',
      icon: 'fa-solid fa-chart-line',
      badge: 'Hoy',
      badgeColor: 'bg-[#ef0606]'
    },
    {
      id: 'clientes',
      label: 'Cartera de Clientes',
      subtitle: 'Cuentas y créditos',
      description: 'Directorio de clientes asignados, saldo de crédito disponible, historial de facturas y visitas.',
      icon: 'fa-solid fa-address-book'
    },
    {
      id: 'asistente_ia',
      label: 'Asistente de Ventas IA',
      subtitle: 'Consulta datos reales',
      description: 'Pregunta en lenguaje natural sobre tus ventas, clientes y productos: el asistente consulta directamente el Data Warehouse (sin datos inventados).',
      icon: 'fa-solid fa-robot',
      badge: 'Datos Reales',
      badgeColor: 'bg-emerald-600'
    }
  ]);

  protected readonly selectedId = signal<string>('dashboard');

  protected readonly selectedItem = computed(() =>
    this.sidebarItems().find((item) => item.id === this.selectedId())
  );

  // ============================================================
  // Reporte del vendedor (backend/reporting) -- ver
  // backend/reporting/README.md. Todo lo de acá abajo reemplaza los KPIs
  // y la tabla de "Proformas recientes" mockeados que había antes.
  // ============================================================

  private readonly hoy = new Date();

  // Filtro de mes (independiente del filtro de semana): controla cuota,
  // top de productos y el gráfico cuando periodoModo() === 'mes'. Por
  // defecto siempre arranca en el mes actual.
  protected readonly filtroAnio = signal<number>(this.hoy.getFullYear());
  protected readonly filtroMes = signal<number>(this.hoy.getMonth() + 1);

  // Filtro de semana: solo controla el gráfico cuando periodoModo() ===
  // 'semana'. Se guarda como el lunes de la semana (fecha simple), y solo
  // se convierte a año/semana ISO al llamar al backend -- evita reimplementar
  // aritmética de semana ISO para "semana anterior/siguiente".
  protected readonly filtroSemanaLunes = signal<Date>(this.lunesDeSemana(this.hoy));

  protected readonly periodoModo = signal<PeriodoModo>('mes');
  protected readonly productosOrden = signal<'asc' | 'desc'>('desc');

  protected readonly cargandoReporte = signal<boolean>(true);
  protected readonly errorReporte = signal<string | null>(null);

  protected readonly cuota = signal<CuotaVendedor | null>(null);
  protected readonly ventasDias = signal<VentaDia[]>([]);
  protected readonly productosTop = signal<ProductoVendedor[]>([]);
  protected readonly clientesInactivos = signal<ClienteInactivo[]>([]);

  protected readonly totalVentasPeriodo = computed(() =>
    this.ventasDias().reduce((acc, d) => acc + d.total_soles, 0)
  );

  protected readonly totalLineasPeriodo = computed(() =>
    this.ventasDias().reduce((acc, d) => acc + d.cantidad, 0)
  );

  protected readonly porcentajeCumplimiento = computed<number | null>(() => {
    const pct = this.cuota()?.porcentaje_cumplimiento;
    return pct === undefined ? null : pct;
  });

  // Tope visual del "tachito de pintura" en 100% -- el % real (que puede
  // superar 100, ver backend/reporting) se muestra aparte como texto.
  protected readonly llenadoTachito = computed(() => {
    const pct = this.porcentajeCumplimiento();
    return pct === null ? 0 : Math.min(100, Math.max(0, pct));
  });

  protected readonly colorTachito = computed(() => {
    const pct = this.porcentajeCumplimiento();
    if (pct === null) return '#94a3b8'; // slate-400: sin meta configurada
    if (pct >= 100) return '#10b981'; // emerald-500: meta cumplida
    if (pct >= 50) return '#0d3393'; // navy de marca: en camino
    return '#ef0606'; // rojo de marca: alerta, muy por debajo
  });

  // meta_mensual y meta_semanal son campos independientes (ver
  // backend/admin/.../User.java) -- este texto/valor sigue al modo activo
  // del filtro, igual que el resto del reporte.
  protected readonly etiquetaMeta = computed(() => (this.periodoModo() === 'semana' ? 'semanal' : 'mensual'));
  protected readonly metaAplicada = computed(() => this.cuota()?.meta_aplicada ?? null);

  protected readonly periodoLabel = computed(() => {
    if (this.periodoModo() === 'semana') {
      const lunes = this.filtroSemanaLunes();
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      return `Semana del ${this.formatoCorto(lunes)} al ${this.formatoCorto(domingo)}`;
    }
    const fecha = new Date(this.filtroAnio(), this.filtroMes() - 1, 1);
    const texto = fecha.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  });

  protected readonly chartData = computed<BusinessChartData>(() => ({
    id: 'chart-ventas-vendedor',
    title: this.periodoModo() === 'semana' ? 'Ventas por día (semana)' : 'Ventas por día (mes)',
    subtitle: this.periodoLabel(),
    type: 'bar',
    labels: this.ventasDias().map((d) => this.formatoCortoDesdeIso(d.fecha)),
    datasets: [
      {
        label: 'Ventas (S/)',
        data: this.ventasDias().map((d) => d.total_soles),
        backgroundColor: '#0d3393',
        borderWidth: 0
      }
    ]
  }));

  constructor() {
    this.cargarTodo();
  }

  protected onSelectedIdChange(id: string) {
    this.selectedId.set(id);
    this.isMobileMenuOpen.set(false);
  }

  protected toggleSidebarCollapse() {
    this.isSidebarCollapsed.update((v) => !v);
  }

  protected toggleMobileMenu() {
    this.isMobileMenuOpen.update((v) => !v);
  }

  protected cerrarSesion() {
    this.authService.logout();
  }

  protected setPeriodoModo(modo: PeriodoModo) {
    if (this.periodoModo() === modo) return;
    this.periodoModo.set(modo);
    // La cuota tambien depende del modo (meta_mensual vs. meta_semanal, ver
    // backend/reporting: /vendedores/me/cuota?modo=...), no solo el grafico.
    this.cargarCuota();
    this.cargarVentas();
  }

  protected periodoAnterior() {
    if (this.periodoModo() === 'semana') {
      this.moverSemana(-1);
      this.cargarCuota();
      this.cargarVentas();
    } else {
      this.moverMes(-1);
      this.cargarCuota();
      this.cargarVentas();
      this.cargarProductos();
    }
  }

  protected periodoSiguiente() {
    if (this.periodoModo() === 'semana') {
      this.moverSemana(1);
      this.cargarCuota();
      this.cargarVentas();
    } else {
      this.moverMes(1);
      this.cargarCuota();
      this.cargarVentas();
      this.cargarProductos();
    }
  }

  protected setProductosOrden(orden: 'asc' | 'desc') {
    if (this.productosOrden() === orden) return;
    this.productosOrden.set(orden);
    this.cargarProductos();
  }

  protected primerNombre(nombreCompleto: string | undefined | null): string {
    if (!nombreCompleto) return '';
    return nombreCompleto.trim().split(/\s+/)[0];
  }

  private moverMes(delta: number) {
    let mes = this.filtroMes() + delta;
    let anio = this.filtroAnio();
    if (mes < 1) {
      mes = 12;
      anio -= 1;
    } else if (mes > 12) {
      mes = 1;
      anio += 1;
    }
    this.filtroMes.set(mes);
    this.filtroAnio.set(anio);
  }

  private moverSemana(deltaSemanas: number) {
    const nuevoLunes = new Date(this.filtroSemanaLunes());
    nuevoLunes.setDate(nuevoLunes.getDate() + deltaSemanas * 7);
    this.filtroSemanaLunes.set(nuevoLunes);
  }

  private async cargarTodo() {
    this.cargandoReporte.set(true);
    this.errorReporte.set(null);
    try {
      await Promise.all([
        this.cargarCuota(),
        this.cargarVentas(),
        this.cargarProductos(),
        this.cargarClientesInactivos()
      ]);
    } finally {
      this.cargandoReporte.set(false);
    }
  }

  private async cargarCuota() {
    try {
      const isoSemana = this.isoDeFecha(this.filtroSemanaLunes());
      const cuota = await this.reportingService.getCuota({
        modo: this.periodoModo(),
        anio: this.filtroAnio(),
        mes: this.filtroMes(),
        anioIso: isoSemana.anio,
        semanaIso: isoSemana.semana
      });
      this.cuota.set(cuota);
      this.errorReporte.set(null);
    } catch (err) {
      this.errorReporte.set(this.mensajeErrorReporte(err));
    }
  }

  private async cargarVentas() {
    try {
      const isoSemana = this.isoDeFecha(this.filtroSemanaLunes());
      const respuesta = await this.reportingService.getVentasPeriodo({
        modo: this.periodoModo(),
        anio: this.filtroAnio(),
        mes: this.filtroMes(),
        anioIso: isoSemana.anio,
        semanaIso: isoSemana.semana
      });
      this.ventasDias.set(respuesta.dias);
      this.errorReporte.set(null);
    } catch (err) {
      this.errorReporte.set(this.mensajeErrorReporte(err));
    }
  }

  private async cargarProductos() {
    try {
      const respuesta = await this.reportingService.getProductosTop(
        this.filtroAnio(),
        this.filtroMes(),
        this.productosOrden(),
        5
      );
      this.productosTop.set(respuesta.productos);
      this.errorReporte.set(null);
    } catch (err) {
      this.errorReporte.set(this.mensajeErrorReporte(err));
    }
  }

  private async cargarClientesInactivos() {
    try {
      const respuesta = await this.reportingService.getClientesInactivos(45, 5);
      this.clientesInactivos.set(respuesta.clientes);
      this.errorReporte.set(null);
    } catch (err) {
      this.errorReporte.set(this.mensajeErrorReporte(err));
    }
  }

  /**
   * Mensaje especifico segun el codigo HTTP que devolvio reporting -- ver
   * backend/reporting/src/auth.py. Sin esto, un 401 (sesion sin token
   * valido) y un 409 (vendedor no vinculado) se veian con el mismo texto
   * generico, lo que hacia mas lento diagnosticar cual era el problema real.
   */
  private mensajeErrorReporte(err: unknown): string {
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    switch (status) {
      case 401:
        return 'Tu sesión no tiene un token válido para backend/reporting. Cierra sesión y vuelve a ' +
          'iniciar sesión (si ya estabas logueado antes de este cambio, tu sesión guardada en el ' +
          'navegador no tiene el token nuevo).';
      case 403:
        return 'Tu usuario no tiene rol VENDEDOR -- este dashboard solo muestra datos para ese rol.';
      case 409:
        return 'Tu usuario no tiene un vendedor vinculado (vendedorNombreSap) en el panel admin -- ' +
          'no se puede relacionar tu sesión con ventas del Data Warehouse todavía.';
      case 0:
        return 'No se pudo conectar con backend/reporting en localhost:8093. Verifica que el servicio esté corriendo.';
      default:
        return `backend/reporting respondió un error (HTTP ${status}). Revisa los logs del servicio.`;
    }
  }

  // ----- Helpers de fecha (equivalentes a lo que hace backend/reporting con date/isocalendar de Python) -----

  /** Lunes de la semana que contiene `fecha` (semana ISO, lunes=inicio). */
  private lunesDeSemana(fecha: Date): Date {
    const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const dow = (d.getDay() + 6) % 7; // lunes=0 ... domingo=6
    d.setDate(d.getDate() - dow);
    return d;
  }

  /** Año y número de semana ISO-8601 de `fecha` (mismo criterio que date.isocalendar() de Python). */
  private isoDeFecha(fecha: Date): { anio: number; semana: number } {
    const jueves = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const dow = (jueves.getDay() + 6) % 7;
    jueves.setDate(jueves.getDate() - dow + 3);

    const primerJueves = new Date(jueves.getFullYear(), 0, 4);
    const dowPrimero = (primerJueves.getDay() + 6) % 7;
    primerJueves.setDate(primerJueves.getDate() - dowPrimero + 3);

    const semana = 1 + Math.round((jueves.getTime() - primerJueves.getTime()) / (7 * 86400000));
    return { anio: jueves.getFullYear(), semana };
  }

  protected formatoCorto(fecha: Date): string {
    return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  }

  private formatoCortoDesdeIso(fechaIso: string): string {
    const [anio, mes, dia] = fechaIso.split('-').map(Number);
    return this.formatoCorto(new Date(anio, mes - 1, dia));
  }
}
