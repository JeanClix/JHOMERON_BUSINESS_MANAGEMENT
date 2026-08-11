export interface InsightCard {
  id: string;
  title: string;
  category: 'ventas' | 'marcos-operativos' | 'marina' | 'rentabilidad' | 'tendencias';
  categoryLabel: string;
  impactLevel: 'alto' | 'medio' | 'oportunidad' | 'alerta';
  impactBadgeColor: string;
  summary: string;
  description: string;
  keyMetric: string;
  recommendation: string;
  date: string;
  actionPrompt?: string; // Prompt suggestion for chatbot
}
