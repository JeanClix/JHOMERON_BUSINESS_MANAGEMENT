export interface KpiMetric {
  id: string;
  title: string;
  value: string;
  subtitle?: string;
  numericValue: number;
  unit?: string;
  changePercent: number; // e.g. +14.2 or -3.1
  changeType: 'increase' | 'decrease' | 'neutral';
  comparisonLabel: string; // e.g. "vs mes anterior"
  icon: string; // FontAwesome icon class
  colorTheme: 'blue' | 'red' | 'emerald' | 'amber' | 'indigo' | 'slate';
  badge?: string;
}
