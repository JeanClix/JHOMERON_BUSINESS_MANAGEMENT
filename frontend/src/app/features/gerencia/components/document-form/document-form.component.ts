import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContextDocumentService } from '../../../../core/services/context-document.service';
import { CONTEXT_DOC_ROLES, ContextDocRol, ContextDocument } from '../../../../core/models/context-document.model';

const CATEGORIAS = [
  { valor: 'general', label: 'General' },
  { valor: 'lineas-producto', label: 'Líneas de producto' },
  { valor: 'procesos', label: 'Procesos' },
  { valor: 'financiero', label: 'Financiero' },
  { valor: 'politicas', label: 'Políticas' }
];

/**
 * Modal de alta/edición de un documento de contexto (rag.documento) -- se
 * monta como overlay sobre GerenciaDocumentacionComponent, tanto desde
 * /gerencia/documentacion como desde /admin/documentos (misma página,
 * montada dos veces, ver app.routes.ts).
 */
@Component({
  selector: 'app-document-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" (click)="onBackdropClick($event)">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8" (click)="$event.stopPropagation()">
        <div class="flex items-center justify-between mb-6">
          <h4 class="text-lg font-bold text-slate-800">
            {{ documentoId() ? 'Editar Documento' : 'Nuevo Documento' }}
          </h4>
          <button type="button" (click)="cancel.emit()" class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        @if (errorMessage()) {
          <div class="mb-6 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm">
            {{ errorMessage() }}
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Título *</label>
              <input type="text" formControlName="titulo"
                class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                placeholder="Ej: Política Comercial de Créditos" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Categoría *</label>
              <select formControlName="categoria"
                class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow appearance-none">
                @for (cat of categorias; track cat.valor) {
                  <option [value]="cat.valor">{{ cat.label }}</option>
                }
              </select>
            </div>
          </div>

          @if (documentoId()) {
            <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Contenido actualmente guardado</span>
                @if (contenidoActual()) {
                  <button type="button" (click)="descargarActual()" class="text-xs font-semibold text-[#0d3393] hover:underline flex items-center gap-1">
                    <i class="fa-solid fa-download"></i> Descargar .md
                  </button>
                }
              </div>
              @if (cargandoContenido()) {
                <p class="text-xs text-slate-400">Cargando...</p>
              } @else {
                <div class="text-xs text-slate-600 whitespace-pre-line max-h-40 overflow-y-auto font-mono leading-relaxed">
                  {{ contenidoActual() || 'Sin contenido.' }}
                </div>
              }
            </div>
          }

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">
              Archivo {{ documentoId() ? '(dejar vacío para no cambiar el contenido de arriba)' : '*' }}
            </label>
            <input type="file" accept=".md,.txt,.pdf,.docx" (change)="onArchivoSeleccionado($event)"
              class="w-full text-sm text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-blue-50 file:text-[#0d3393] file:font-medium hover:file:bg-blue-100 bg-slate-50 border border-slate-200 rounded-xl" />
            <p class="text-xs text-slate-400 mt-1.5">
              Formatos aceptados: .md, .txt, .pdf, .docx. Un PDF escaneado sin capa de texto no funciona (no hay OCR).
              @if (documentoId()) {
                Si seleccionas un archivo aquí, <strong>reemplaza por completo</strong> el contenido de arriba.
              }
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Visible para</label>
            <div class="flex gap-3">
              @for (rol of rolesDisponibles; track rol) {
                <label class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-colors"
                  [class.border-blue-500]="rolesSeleccionados().has(rol)"
                  [class.bg-blue-50]="rolesSeleccionados().has(rol)"
                  [class.border-slate-200]="!rolesSeleccionados().has(rol)">
                  <input type="checkbox" [checked]="rolesSeleccionados().has(rol)" (change)="toggleRol(rol)" class="accent-blue-600" />
                  <span class="text-sm font-medium text-slate-700">{{ rol }}</span>
                </label>
              }
            </div>
            <p class="text-xs text-slate-400 mt-1.5">
              Quiénes pueden encontrar este documento al preguntarle al chat de IA. Por defecto, todos.
            </p>
          </div>

          <div class="pt-6 border-t border-slate-100 flex justify-end space-x-4">
            <button type="button" (click)="cancel.emit()" class="px-6 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button type="submit" [disabled]="form.invalid || guardando()" class="px-6 py-2.5 rounded-xl font-medium text-white bg-[#0d3393] hover:bg-[#0b2670] disabled:opacity-50 shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105">
              {{ guardando() ? 'Guardando...' : 'Guardar Documento' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class DocumentFormComponent implements OnInit {
  private readonly service = inject(ContextDocumentService);
  private readonly fb = inject(FormBuilder);

  protected readonly categorias = CATEGORIAS;
  protected readonly rolesDisponibles = CONTEXT_DOC_ROLES;

  /** null = alta nueva. Con id, precarga título/categoría/roles/contenido. */
  documentoId = input<number | null>(null);
  saved = output<void>();
  cancel = output<void>();

  guardando = signal(false);
  errorMessage = signal<string | null>(null);
  archivoSeleccionado = signal<File | null>(null);
  rolesSeleccionados = signal<Set<ContextDocRol>>(new Set(CONTEXT_DOC_ROLES));
  contenidoActual = signal<string | null>(null);
  cargandoContenido = signal(false);

  form = this.fb.group({
    titulo: ['', Validators.required],
    categoria: ['general', Validators.required]
  });

  ngOnInit() {
    const id = this.documentoId();
    if (!id) return;

    this.cargandoContenido.set(true);
    this.service.obtener(id).subscribe({
      next: (doc) => {
        this.form.setValue({ titulo: doc.titulo, categoria: doc.categoria });
        this.rolesSeleccionados.set(new Set(doc.rolesVisibles));
        this.contenidoActual.set(doc.contenido ?? '');
        this.cargandoContenido.set(false);
      },
      error: () => {
        this.cargandoContenido.set(false);
        this.errorMessage.set('No se pudo cargar el documento a editar.');
      }
    });
  }

  protected onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) this.cancel.emit();
  }

  protected onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    this.archivoSeleccionado.set(input.files?.[0] ?? null);
  }

  protected toggleRol(rol: ContextDocRol) {
    const actual = new Set(this.rolesSeleccionados());
    if (actual.has(rol)) {
      // Al menos un rol debe quedar seleccionado -- un documento sin roles
      // visibles no lo encontraría nadie en la búsqueda y quedaría "perdido"
      // sin ningún mensaje de error visible.
      if (actual.size > 1) actual.delete(rol);
    } else {
      actual.add(rol);
    }
    this.rolesSeleccionados.set(actual);
  }

  protected descargarActual() {
    const contenido = this.contenidoActual();
    const titulo = this.form.value.titulo || 'documento';
    if (!contenido) return;

    const nombreArchivo = `${titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    const blob = new Blob([contenido], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected onSubmit() {
    if (this.form.invalid || this.guardando()) return;
    const id = this.documentoId();
    if (!id && !this.archivoSeleccionado()) {
      this.errorMessage.set('Selecciona un archivo para el nuevo documento.');
      return;
    }

    this.guardando.set(true);
    this.errorMessage.set(null);

    const payload = {
      titulo: this.form.value.titulo!,
      categoria: this.form.value.categoria as ContextDocument['categoria'],
      rolesVisibles: Array.from(this.rolesSeleccionados()),
      ...(this.archivoSeleccionado() ? { archivo: this.archivoSeleccionado()! } : {})
    };

    const peticion = id ? this.service.actualizar(id, payload) : this.service.crear(payload);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.saved.emit();
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorMessage.set(err?.error?.detail || 'No se pudo guardar el documento.');
      }
    });
  }
}
