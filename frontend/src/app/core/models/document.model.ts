export interface DocumentOutlineItem {
  id: string;
  title: string;
  level: number;
}

export interface BusinessDocument {
  id: string;
  title: string;
  category: 'general' | 'lineas-producto' | 'procesos' | 'financiero' | 'indicadores' | 'politicas';
  categoryLabel: string;
  summary: string;
  content: string;
  author: string;
  lastUpdated: string;
  version: string;
  readingTime: string;
  tags: string[];
  outline: DocumentOutlineItem[];
  keyTakeaways: string[];
  relatedMetrics?: string[];
  featured?: boolean;
}
