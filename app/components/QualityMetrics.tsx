'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { translateMetricDetail } from '@/app/lib/metric-translation';
import type { QualityAssessment } from '@/app/types';

interface QualityMetricsProps {
  assessment: QualityAssessment;
}

export function QualityMetrics({ assessment }: QualityMetricsProps) {
  const t = useTranslations();
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);

  const toggleDimension = (dimensionKey: string) => {
    setExpandedDimension(expandedDimension === dimensionKey ? null : dimensionKey);
  };

  const dimensions = [
    { key: 'findability', data: assessment.dimensions.findability },
    { key: 'accessibility', data: assessment.dimensions.accessibility },
    { key: 'interoperability', data: assessment.dimensions.interoperability },
    { key: 'reusability', data: assessment.dimensions.reusability },
    { key: 'contextuality', data: assessment.dimensions.contextuality },
  ];

  return (
    <div className="space-y-3">
      {dimensions.map(({ key, data }) => (
        <div
          key={key}
          className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
        >
          {/* Dimension Header */}
          <button
            onClick={() => toggleDimension(key)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800
                       hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg',
                  (data.score / data.weight) >= 0.8
                    ? 'bg-success-light text-success-dark'
                    : (data.score / data.weight) >= 0.6
                    ? 'bg-warning-light text-warning-dark'
                    : 'bg-error-light text-error-dark'
                )}
              >
                {Math.round(data.score)}
              </div>
              <div className="text-left">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {t(`quality.${key}`)}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {data.metrics.filter(m => m.passed).length} / {data.metrics.length} metrics passed
                </p>
              </div>
            </div>
            <div>
              {expandedDimension === key ? (
                <ChevronUp className="text-gray-500" size={20} />
              ) : (
                <ChevronDown className="text-gray-500" size={20} />
              )}
            </div>
          </button>

          {/* Dimension Metrics (Expanded) */}
          {expandedDimension === key && (
            <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <div className="space-y-3">
                {data.metrics.map((metric) => (
                  <div
                    key={metric.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {metric.passed ? (
                        <CheckCircle className="text-success" size={18} />
                      ) : (
                        <XCircle className="text-error" size={18} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">
                          {metric.name}
                        </p>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {Math.round(metric.value)}%
                        </span>
                      </div>
                      {metric.details && (
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          {translateMetricDetail(metric.details, t)}
                        </p>
                      )}
                      
                      {/* Progress Bar */}
                      <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className={cn(
                            'h-1.5 rounded-full transition-all',
                            metric.passed ? 'bg-success' : 'bg-warning'
                          )}
                          style={{ width: `${metric.value}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
