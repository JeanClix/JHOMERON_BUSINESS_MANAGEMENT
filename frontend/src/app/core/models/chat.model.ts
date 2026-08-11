import { KpiMetric } from './kpi.model';
import { BusinessChartData } from './chart.model';
import { InsightCard } from './insight.model';

export type ProcessingStage =
  | 'idle'
  | 'analyzing_query'
  | 'fetching_data'
  | 'preparing_analysis'
  | 'generating_visualization'
  | 'completed';

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  isCurrency?: boolean;
  isBadge?: boolean;
}

export interface TableData {
  title: string;
  subtitle?: string;
  columns: TableColumn[];
  rows: Record<string, any>[];
}

export interface AiAnalysisResponse {
  id: string;
  query: string;
  timestamp: string;
  summary: string;
  kpis?: KpiMetric[];
  chart?: BusinessChartData;
  table?: TableData;
  insights?: InsightCard[];
  recommendations?: string[];
  sources?: { title: string; docId?: string }[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: { title: string; docId?: string }[];
  keyDataPoints?: { label: string; value: string }[];
  suggestedFollowUps?: string[];
  isStreaming?: boolean;
}

export interface ChatPresetPrompt {
  id: string;
  icon: string;
  title: string;
  prompt: string;
  category: 'ventas' | 'marina' | 'rentabilidad' | 'documentos';
}
