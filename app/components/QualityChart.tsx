'use client';

import { useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import type { QualityAssessment } from '@/app/types';

// Register Chart.js components
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export interface QualityChartRef {
  downloadChart: () => void;
}

interface QualityChartProps {
  assessment: QualityAssessment;
  onChartReady?: (ref: QualityChartRef) => void;
}

export function QualityChart({ assessment, onChartReady }: QualityChartProps) {
  const t = useTranslations();
  const chartRef = useRef<ChartJS<'radar'>>(null);
  
  // Expose download function to parent
  useEffect(() => {
    if (chartRef.current && onChartReady) {
      onChartReady({
        downloadChart: () => {
          if (chartRef.current) {
            const url = chartRef.current.toBase64Image();
            const link = document.createElement('a');
            link.download = 'fair-c-chart.png';
            link.href = url;
            link.click();
          }
        }
      });
    }
  }, [onChartReady]);

  const data = {
    labels: [
      t('quality.findability'),
      t('quality.accessibility'),
      t('quality.interoperability'),
      t('quality.reusability'),
      t('quality.contextuality'),
    ],
    datasets: [
      {
        label: t('results.chart'),
        data: [
          (assessment.dimensions.findability.score / assessment.dimensions.findability.weight) * 100,
          (assessment.dimensions.accessibility.score / assessment.dimensions.accessibility.weight) * 100,
          (assessment.dimensions.interoperability.score / assessment.dimensions.interoperability.weight) * 100,
          (assessment.dimensions.reusability.score / assessment.dimensions.reusability.weight) * 100,
          (assessment.dimensions.contextuality.score / assessment.dimensions.contextuality.weight) * 100,
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(59, 130, 246)',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          color: 'rgb(156, 163, 175)',
          backdropColor: 'transparent',
          showLabelBackdrop: false,
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.2)',
        },
        angleLines: {
          color: 'rgba(156, 163, 175, 0.2)',
        },
        pointLabels: {
          color: 'rgb(75, 85, 99)',
          font: {
            size: 12,
            weight: 500,
          },
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${context.label}: ${Math.round(context.parsed.r)}%`;
          },
        },
      },
    },
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <Radar ref={chartRef} data={data} options={options} />
    </div>
  );
}
