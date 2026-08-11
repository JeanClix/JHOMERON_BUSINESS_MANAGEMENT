export type ChartType = 'line' | 'bar' | 'doughnut' | 'pie' | 'radar';

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  fill?: boolean;
  tension?: number;
}

export interface BusinessChartData {
  id: string;
  title: string;
  subtitle?: string;
  type: ChartType;
  labels: string[];
  datasets: ChartDataset[];
  height?: string;
  summaryNote?: string;
}
