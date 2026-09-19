import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  AfterViewInit,
  ViewChild,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { BusinessChartData, ChartType } from '../../../core/models/chart.model';

Chart.register(...registerables);

@Component({
  selector: 'app-business-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-2xl bg-white p-5 border border-slate-200 shadow-sm flex flex-col justify-between h-full">
      <div>
        <div class="flex items-center justify-between mb-1">
          <h3 class="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-[#0d3393]"></span>
            {{ chartData?.title || title }}
          </h3>
          <div class="flex items-center gap-1.5 shrink-0">
            @if (explainable) {
              <button
                type="button"
                (click)="explain.emit()"
                title="Preguntarle a la IA sobre este gráfico"
                class="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-[#0d3393] hover:text-white transition-colors"
              >
                <i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
              </button>
            }
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              {{ chartType | uppercase }}
            </span>
          </div>
        </div>
        
        @if (chartData?.subtitle || subtitle) {
          <p class="text-xs text-slate-500 mb-4">
            {{ chartData?.subtitle || subtitle }}
          </p>
        }
      </div>

      <div class="relative w-full my-auto flex-1 min-h-[220px]" [style.height]="height || '240px'">
        <canvas #chartCanvas></canvas>
      </div>

      @if (chartData?.summaryNote || summaryNote) {
        <div class="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
          <i class="fa-solid fa-circle-info text-[#0d3393] text-xs"></i>
          <span class="font-medium">{{ chartData?.summaryNote || summaryNote }}</span>
        </div>
      }
    </div>
  `
})
export class BusinessChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  @Input() chartData?: BusinessChartData;
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() chartType: ChartType = 'bar';
  @Input() labels: string[] = [];
  @Input() datasets: any[] = [];
  @Input() options: any = {};
  @Input() height: string = '240px';
  @Input() summaryNote?: string;
  @Input() explainable = false;
  @Output() explain = new EventEmitter<void>();

  private chartInstance?: Chart;

  ngAfterViewInit() {
    this.createChart();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.chartInstance && (changes['chartData'] || changes['datasets'] || changes['labels'])) {
      this.updateChart();
    }
  }

  ngOnDestroy() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
  }

  private createChart() {
    if (!this.chartCanvas) return;

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const type = this.chartData?.type || this.chartType;
    const labels = this.chartData?.labels || this.labels;
    const datasets = this.chartData?.datasets || this.datasets;

    const defaultOptions: any = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            font: {
              family: 'Outfit, sans-serif',
              size: 11,
              weight: '500'
            }
          }
        },
        tooltip: {
          backgroundColor: '#0c2461',
          titleFont: { family: 'Outfit, sans-serif', size: 12, weight: 'bold' },
          bodyFont: { family: 'Outfit, sans-serif', size: 11 },
          padding: 10,
          cornerRadius: 8
        }
      },
      scales: (type === 'line' || type === 'bar') ? {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Outfit, sans-serif', size: 10 } }
        },
        y: {
          border: { dash: [4, 4] },
          ticks: { font: { family: 'Outfit, sans-serif', size: 10 } }
        }
      } : {}
    };

    const config: ChartConfiguration = {
      type: type as any,
      data: {
        labels,
        datasets
      },
      options: { ...defaultOptions, ...this.options }
    };

    this.chartInstance = new Chart(ctx, config);
  }

  private updateChart() {
    if (!this.chartInstance) return;

    const labels = this.chartData?.labels || this.labels;
    const datasets = this.chartData?.datasets || this.datasets;

    this.chartInstance.data.labels = labels;
    this.chartInstance.data.datasets = datasets;
    this.chartInstance.update();
  }
}
