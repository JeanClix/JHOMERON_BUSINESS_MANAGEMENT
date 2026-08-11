import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GerenciaDataService } from '../../../../core/services/gerencia-data.service';
import { BusinessDocument } from '../../../../core/models/document.model';
import { DocumentExplorerComponent } from '../../components/document-explorer/document-explorer.component';
import { DocumentViewerComponent } from '../../components/document-viewer/document-viewer.component';
import { GerenciaChatService } from '../../../../core/services/gerencia-chat.service';

@Component({
  selector: 'app-gerencia-documentacion',
  standalone: true,
  imports: [
    CommonModule,
    DocumentExplorerComponent,
    DocumentViewerComponent
  ],
  template: `
    <div class="space-y-6">
      <!-- Title Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span class="text-xs font-bold text-[#0d3393] uppercase tracking-wider bg-[#0d3393]/10 px-2.5 py-0.5 rounded">
            DEEPWIKI ENTERPRISE
          </span>
          <h1 class="text-2xl font-black text-slate-900 mt-1">
            Base de Conocimiento y Documentación Empresarial
          </h1>
          <p class="text-xs text-slate-500">
            Repositorio estructurado de manuales técnicos, políticas de crédito, reportes financieros y procedimientos de calidad Jhomeron.
          </p>
        </div>
      </div>

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
            (askAiAboutDoc)="onAskAiAboutDoc($event)"
          ></app-document-viewer>
        </div>
      </div>
    </div>
  `
})
export class GerenciaDocumentacionComponent implements OnInit {
  private dataService = inject(GerenciaDataService);
  private chatService = inject(GerenciaChatService);
  private router = inject(Router);

  documents = signal<BusinessDocument[]>([]);
  selectedDoc = signal<BusinessDocument | null>(null);

  ngOnInit() {
    this.dataService.getBusinessDocuments().subscribe(docs => {
      this.documents.set(docs);
      if (docs.length > 0) {
        this.selectedDoc.set(docs[0]);
      }
    });
  }

  onSelectDocument(doc: BusinessDocument) {
    this.selectedDoc.set(doc);
  }

  onAskAiAboutDoc(doc: BusinessDocument) {
    const prompt = `Resume los puntos clave del documento "${doc.title}" y explícame sus implicancias para la gerencia.`;
    this.chatService.sendMessage(prompt);
    this.router.navigate(['/gerencia/chat']);
  }
}
