import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * Convierte el Markdown que devuelve el LLM (negritas, tablas, listas) a
 * HTML sanitizado para mostrarlo con [innerHTML] en el chat -- sin esto el
 * texto se veía con los símbolos de Markdown crudos ("**...**", "| ... |").
 * DOMPurify sanitiza antes de confiar en el HTML: el contenido viene de un
 * LLM (y de datos reales del DWH que podrían tener caracteres raros), nunca
 * se debe insertar sin sanitizar.
 */
@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value) return '';
    const html = marked.parse(value, { breaks: true, async: false }) as string;
    const limpio = DOMPurify.sanitize(html);
    return this.sanitizer.bypassSecurityTrustHtml(limpio);
  }
}
