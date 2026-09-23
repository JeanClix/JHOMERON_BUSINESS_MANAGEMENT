import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GerenciaDataService } from '../../../../core/services/gerencia-data.service';
import { ContextDocumentService } from '../../../../core/services/context-document.service';
import { AuthService } from '../../../../core/services/auth.service';
import { BusinessDocument } from '../../../../core/models/document.model';
import { DocumentExplorerComponent } from '../../components/document-explorer/document-explorer.component';
import { DocumentViewerComponent } from '../../components/document-viewer/document-viewer.component';
import { DocumentFormComponent } from '../../components/document-form/document-form.component';
import { GerenciaChatService } from '../../../../core/services/gerencia-chat.service';

/**
 * Montada dos veces (ver app.routes.ts): en /gerencia/documentacion (dentro
 * del layout de Gerencia) y en /admin/documentos (dentro del layout de
 * Admin) -- misma página, cada una con su propio sidebar/navegación, en vez
 * de mantener una página de gestión aparte fuera de ambos layouts.
 */
@Component({
  selector: 'app-gerencia-documentacion',
  standalone: true,
  imports: [
    CommonModule,
    DocumentExplorerComponent,
    DocumentViewerComponent,
    DocumentFormComponent
  ],
  template: `
    <div class="space-y-6">
      <!-- Title Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span class="text-xs font-bold text-[#0d3393] uppercase tracking-wider bg-[#0d3393]/10 px-2.5 py-0.5 rounded">
            BASE DE CONOCIMIENTO
          </span>
          <h1 class="text-2xl font-black text-slate-900 mt-1">
            Base de Conocimiento y Documentación Empresarial
          </h1>
          <p class="text-xs text-slate-500">
            Repositorio estructurado de manuales técnicos, políticas de crédito, reportes financieros y procedimientos de calidad Jhomeron.
          </p>
        </div>
        <button (click)="nuevoDocumento()" class="shrink-0 flex items-center space-x-2 bg-[#0d3393] hover:bg-[#0b2670] text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Nuevo Documento</span>
        </button>
      </div>

      @if (errorMessage()) {
        <div class="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm">
          {{ errorMessage() }}
        </div>
      }

      <!-- Main Layout Grid: Explorer + Viewer -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-220px)] min-h-[550px]">
        <!-- Left Explorer Column (4 cols) -->
        <div class="lg:col-span-4 h-full">
          <app-document-explorer
            [documents]="documents()"
            [selectedId]="selectedDoc()?.id || ''"
            (selectDocument)="onSelectDocument($event)"
          ></app-document-explorer>
        </div>

        <!-- Right Viewer Column (8 cols) -->
        <div class="lg:col-span-8 h-full">
          <app-document-viewer
            [document]="selectedDoc()"
            [mostrarBotonIA]="puedePreguntarIA()"
            (askAiAboutDoc)="onAskAiAboutDoc($event)"
            (editDoc)="onEditDoc($event)"
            (deactivateDoc)="onDeactivateDoc($event)"
          ></app-document-viewer>
        </div>
      </div>
    </div>

    @if (mostrarFormulario()) {
      <app-document-form
        [documentoId]="editandoId()"
        (saved)="onFormSaved()"
        (cancel)="mostrarFormulario.set(false)"
      ></app-document-form>
    }
  `
})
export class GerenciaDocumentacionComponent implements OnInit {
  private dataService = inject(GerenciaDataService);
  private contextDocumentService = inject(ContextDocumentService);
  private authService = inject(AuthService);
  private chatService = inject(GerenciaChatService);
  private router = inject(Router);

  documents = signal<BusinessDocument[]>([]);
  selectedDoc = signal<BusinessDocument | null>(null);
  errorMessage = signal<string | null>(null);

  mostrarFormulario = signal(false);
  editandoId = signal<number | null>(null);

  // ADMIN no tiene chat de IA en este frontend (solo Ventas y Gerencia) --
  // el botón "Consultar IA" navegaría a /gerencia/chat, bloqueado por
  // roleGuard para ADMIN, así que se oculta directamente.
  protected puedePreguntarIA = computed(() => this.authService.currentUser()?.role !== 'admin');

  ngOnInit() {
    this.cargar();
  }

  private cargar() {
    this.dataService.getBusinessDocuments().subscribe({
      next: (docs) => {
        this.documents.set(docs);
        const seleccionado = this.selectedDoc();
        const sigueExistiendo = seleccionado && docs.some((d) => d.id === seleccionado.id);
        const idAMostrar = sigueExistiendo ? seleccionado!.id : docs[0]?.id;
        if (idAMostrar) this.seleccionarDocumento(idAMostrar);
        else this.selectedDoc.set(null);
      },
      error: () => this.errorMessage.set('No se pudieron cargar los documentos.')
    });
  }

  onSelectDocument(doc: BusinessDocument) {
    this.seleccionarDocumento(doc.id);
  }

  /** El listado (getBusinessDocuments) solo trae un resumen corto, no el
   * contenido completo -- evita mandar todo el texto de cada documento de
   * una sola vez. El visor necesita el detalle completo, así que se pide
   * aparte cada vez que se selecciona un documento. */
  private seleccionarDocumento(id: string) {
    this.dataService.getDocumentById(id).subscribe({
      next: (doc) => this.selectedDoc.set(doc ?? null),
      error: () => this.errorMessage.set('No se pudo cargar el contenido del documento.')
    });
  }

  onAskAiAboutDoc(doc: BusinessDocument) {
    const prompt = `Resume los puntos clave del documento "${doc.title}" y explícame sus implicancias para la gerencia.`;
    this.chatService.sendMessage(prompt);
    this.router.navigate(['/gerencia/chat']);
  }

  protected nuevoDocumento() {
    this.editandoId.set(null);
    this.mostrarFormulario.set(true);
  }

  protected onEditDoc(doc: BusinessDocument) {
    this.editandoId.set(Number(doc.id));
    this.mostrarFormulario.set(true);
  }

  protected onFormSaved() {
    this.mostrarFormulario.set(false);
    this.cargar();
  }

  protected onDeactivateDoc(doc: BusinessDocument) {
    if (!confirm(`¿Quitar el documento "${doc.title}"? Se borra por completo y ya no aparecerá en las búsquedas del chat.`)) return;

    this.contextDocumentService.eliminar(Number(doc.id)).subscribe({
      next: () => {
        if (this.selectedDoc()?.id === doc.id) this.selectedDoc.set(null);
        this.cargar();
      },
      error: () => this.errorMessage.set('No se pudo quitar el documento.')
    });
  }
}
