import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { SidebarComponent } from '../../common/sidebar/sidebar.component';
import { SidebarItem } from '../../common/sidebar-item/sidebar-item.component';
import { VentasAiChatComponent } from './components/ventas-ai-chat/ventas-ai-chat.component';
import { BusinessChartComponent } from '../../shared/components/business-chart/business-chart.component';
import { AuthService } from '../../core/services/auth.service';
import { ReportingService } from '../../core/services/reporting.service';
import { BusinessChartData } from '../../core/models/chart.model';
import {
  ClienteCartera,
  ClienteInactivo,
  CuotaVendedor,
  PeriodoModo,
  ProductoVendedor,
  VentaDia
} from '../../core/models/reporting.model';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, VentasAiChatComponent, BusinessChartComponent],
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
      icon: 'fa-solid fa-paint-roller'
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

  // MIN(fecha) real en dwh.fact_ventas (ver TODO.md) -- no se puede navegar
  // a un período que empiece antes de esto porque simplemente no hay datos
  // cargados, no porque el vendedor no haya vendido.
  private readonly limiteInferiorDatos = new Date(2024, 0, 11);

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
  protected readonly clientesCartera = signal<ClienteCartera[]>([]);
  protected readonly cargandoCartera = signal<boolean>(false);
  protected readonly cargadaCartera = signal<boolean>(false);

  // Filtros + paginación de la Cartera de Clientes -- se filtra/pagina en el
  // cliente porque ya se trae la cartera completa (hasta 200) de una vez,
  // no tiene sentido ir al backend por cada tecla o cambio de página.
  protected readonly filtroCarteraCliente = signal<string>('');
  protected readonly filtroCarteraRuc = signal<string>('');
  protected readonly filtroCarteraDepartamento = signal<string>('');
  protected readonly paginaCartera = signal<number>(1);
  protected readonly tamanoPaginaCartera = 5;

  protected readonly departamentosCartera = computed(() =>
    Array.from(new Set(this.clientesCartera().map((c) => c.departamento))).sort()
  );

  protected readonly clientesCarteraFiltrados = computed(() => {
    const texto = this.filtroCarteraCliente().trim().toLowerCase();
    const ruc = this.filtroCarteraRuc().trim().toLowerCase();
    const depto = this.filtroCarteraDepartamento();
    return this.clientesCartera().filter((c) => {
      if (texto && !c.cliente.toLowerCase().includes(texto)) return false;
      if (ruc && !c.ruc.toLowerCase().includes(ruc)) return false;
      if (depto && c.departamento !== depto) return false;
      return true;
    });
  });

  protected readonly totalPaginasCartera = computed(() =>
    Math.max(1, Math.ceil(this.clientesCarteraFiltrados().length / this.tamanoPaginaCartera))
  );

  protected readonly clientesCarteraPagina = computed(() => {
    const inicio = (this.paginaCartera() - 1) * this.tamanoPaginaCartera;
    return this.clientesCarteraFiltrados().slice(inicio, inicio + this.tamanoPaginaCartera);
  });

  protected readonly totalVentasPeriodo = computed(() =>
    this.ventasDias().reduce((acc, d) => acc + d.total_soles, 0)
  );

  // Cantidad de LÍNEAS de venta (COUNT(*) en fact_ventas -- un producto
  // dentro de una factura/documento SAP), no unidades de producto. Antes
  // esta KPI sumaba `cantidad` (unidades vendidas) pero se mostraba con la
  // etiqueta "líneas", lo que confundía: mostraba un número que no
  // correspondía a ningún concepto real del negocio.
  protected readonly totalLineasPeriodo = computed(() =>
    this.ventasDias().reduce((acc, d) => acc + d.numero_lineas, 0)
  );

  protected readonly porcentajeCumplimiento = computed<number | null>(() => {
    const pct = this.cuota()?.porcentaje_cumplimiento;
    return pct === undefined ? null : pct;
  });

  // Color de fondo de la "lata de pintura": rojo si no vendió nada, blanco
  // mientras avanza hacia la meta, verde al llegar o superarla.
  protected readonly colorTachito = computed(() => {
    const pct = this.porcentajeCumplimiento();
    if (pct === null) return '#94a3b8'; // slate-400: sin meta configurada
    if (pct <= 0) return '#ef0606'; // rojo: cero ventas en el período
    if (pct >= 100) return '#10b981'; // emerald-500: meta cumplida
    return '#ffffff'; // blanco: en camino hacia la meta
  });

  // Color del número/porcentaje DENTRO de la lata -- contraste según el
  // color de fondo de arriba (blanco sobre rojo/verde, azul sobre blanco).
  protected readonly colorTextoTachito = computed(() => {
    const pct = this.porcentajeCumplimiento();
    if (pct === null) return '#ffffff';
    if (pct <= 0) return '#ffffff';
    if (pct >= 100) return '#ffffff';
    return '#0d3393'; // navy de marca sobre fondo blanco
  });

  // Habilitación de las flechas de navegación de período: no se puede
  // retroceder antes de `limiteInferiorDatos` (no hay data cargada) ni
  // avanzar a un período que todavía no empieza (después de `hoy`).
  protected readonly puedeAnterior = computed(() => {
    if (this.periodoModo() === 'semana') {
      const domingoAnterior = new Date(this.filtroSemanaLunes());
      domingoAnterior.setDate(domingoAnterior.getDate() - 1);
      return domingoAnterior >= this.limiteInferiorDatos;
    }
    const mesAnterior = this.filtroMes() === 1 ? 12 : this.filtroMes() - 1;
    const anioAnterior = this.filtroMes() === 1 ? this.filtroAnio() - 1 : this.filtroAnio();
    const ultimoDiaMesAnterior = new Date(anioAnterior, mesAnterior, 0);
    return ultimoDiaMesAnterior >= this.limiteInferiorDatos;
  });

  protected readonly puedeSiguiente = computed(() => {
    if (this.periodoModo() === 'semana') {
      const lunesSiguiente = new Date(this.filtroSemanaLunes());
      lunesSiguiente.setDate(lunesSiguiente.getDate() + 7);
      return lunesSiguiente <= this.hoy;
    }
    const mesSiguiente = this.filtroMes() === 12 ? 1 : this.filtroMes() + 1;
    const anioSiguiente = this.filtroMes() === 12 ? this.filtroAnio() + 1 : this.filtroAnio();
    const primerDiaMesSiguiente = new Date(anioSiguiente, mesSiguiente - 1, 1);
    return primerDiaMesSiguiente <= this.hoy;
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
      // El año se agrega siempre (no solo cuando cambia de un año a otro
      // dentro de la semana) para que quede inequívoco a qué año pertenece
      // la semana mostrada.
      const anioTexto = lunes.getFullYear() === domingo.getFullYear()
        ? `${domingo.getFullYear()}`
        : `${lunes.getFullYear()}/${domingo.getFullYear()}`;
      return `Semana del ${this.formatoCorto(lunes)} al ${this.formatoCorto(domingo)} ${anioTexto}`;
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
    // Carga perezosa: la cartera solo se pide la primera vez que se abre la
    // pestaña, no en cargarTodo() del dashboard (evita un request de más si
    // el vendedor nunca la visita).
    if (id === 'clientes' && !this.cargadaCartera()) {
      this.cargarCartera();
    }
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
    if (!this.puedeAnterior()) return;
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
    if (!this.puedeSiguiente()) return;
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

  protected setFiltroCarteraCliente(valor: string) {
    this.filtroCarteraCliente.set(valor);
    this.paginaCartera.set(1);
  }

  protected setFiltroCarteraRuc(valor: string) {
    this.filtroCarteraRuc.set(valor);
    this.paginaCartera.set(1);
  }

  protected setFiltroCarteraDepartamento(valor: string) {
    this.filtroCarteraDepartamento.set(valor);
    this.paginaCartera.set(1);
  }

  protected paginaCarteraAnterior() {
    this.paginaCartera.update((p) => Math.max(1, p - 1));
  }

  protected paginaCarteraSiguiente() {
    this.paginaCartera.update((p) => Math.min(this.totalPaginasCartera(), p + 1));
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

  private async cargarCartera() {
    this.cargandoCartera.set(true);
    try {
      const respuesta = await this.reportingService.getClientesCartera(200);
      this.clientesCartera.set(respuesta.clientes);
      this.cargadaCartera.set(true);
      this.errorReporte.set(null);
    } catch (err) {
      this.errorReporte.set(this.mensajeErrorReporte(err));
    } finally {
      this.cargandoCartera.set(false);
    }
  }

  private async cargarClientesInactivos() {
    try {
      const respuesta = await this.reportingService.getClientesInactivos(30, 5);
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
