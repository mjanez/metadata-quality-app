'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { QualityChart, type QualityChartRef } from './QualityChart';
import { QualityMetrics } from './QualityMetrics';
import { SHACLTable } from './SHACLTable';
import { CheckCircle2, XCircle, AlertTriangle, Download, FileImage, FileSpreadsheet } from 'lucide-react';
import type { ValidationResult } from '@/app/types';
import { groupSimilarResults, exportSHACLReportAsTurtle, exportSHACLReportAsCSV, downloadFile } from '@/app/lib/shacl';
import { downloadMetricsCSV } from '@/app/lib/metrics-export';
import { translateMetricDetail } from '@/app/lib/metric-translation';

interface ValidationResultsProps {
  validationState: {
    result: ValidationResult | null;
    error: string | null;
    isLoading: boolean;
  };
}

export function ValidationResults({ validationState }: ValidationResultsProps) {
  const t = useTranslations();
  const { result, error, isLoading } = validationState;
  const [chartRef, setChartRef] = useState<QualityChartRef | null>(null);

  if (isLoading) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {t('validation.validating')}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-error-light dark:bg-error-dark/20 border border-error">
        <div className="flex items-start gap-3">
          <XCircle className="text-error flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {t('errors.validationError')}
            </h3>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="card border-2 border-dashed border-gray-300 dark:border-gray-700">
        <div className="text-center py-8">
          <AlertTriangle className="mx-auto text-gray-400 dark:text-gray-600 mb-3" size={48} />
          <p className="text-gray-600 dark:text-gray-400">
            {t('results.noResults')}
          </p>
        </div>
      </div>
    );
  }

  const { shaclReport, qualityAssessment, statistics } = result;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('results.summary')}
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {/* SHACL Conformance */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            {shaclReport.conforms ? (
              <CheckCircle2 className="text-success flex-shrink-0" size={24} />
            ) : (
              <XCircle className="text-error flex-shrink-0" size={24} />
            )}
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('shacl.title')}</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {shaclReport.conforms ? t('shacl.conforms') : t('shacl.nonConforms')}
              </p>
            </div>
          </div>

          {/* Overall Quality Score */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-800 flex items-center justify-center">
                <span className="text-lg font-bold text-primary-700 dark:text-primary-300">
                  {Math.round((qualityAssessment.overallScore / qualityAssessment.maxScore) * 100)}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('results.qualityScore')}
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {Math.round(qualityAssessment.overallScore)} / {qualityAssessment.maxScore} pts
              </p>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <StatCard
            label={t('metrics.datasets')}
            value={statistics.datasetsCount}
          />
          <StatCard
            label={t('metrics.distributions')}
            value={statistics.distributionsCount}
          />
          <StatCard
            label={t('metrics.dataServices')}
            value={statistics.dataServicesCount}
          />
        </div>
      </div>

      {/* Quality Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('results.chart')}
          </h3>
          <button
            onClick={() => chartRef?.downloadChart()}
            disabled={!chartRef}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
            title={t('validation.downloadChartPNG')}
          >
            <FileImage size={16} />
            PNG
          </button>
        </div>
        <QualityChart assessment={qualityAssessment} onChartReady={setChartRef} />
      </div>

      {/* Quality Metrics */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('results.metrics')}
          </h3>
          <button
            onClick={() => {
              // Translate details before exporting
              const assessmentWithTranslations = {
                ...qualityAssessment,
                dimensions: Object.fromEntries(
                  Object.entries(qualityAssessment.dimensions).map(([key, dim]) => [
                    key,
                    {
                      ...dim,
                      metrics: dim.metrics.map(m => ({
                        ...m,
                        details: m.details ? translateMetricDetail(m.details, t) : undefined
                      }))
                    }
                  ])
                )
              };
              downloadMetricsCSV(assessmentWithTranslations as any, t);
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
            title={t('validation.downloadMetricsCSV')}
          >
            <FileSpreadsheet size={16} />
            CSV
          </button>
        </div>
        <QualityMetrics assessment={qualityAssessment} />
      </div>

      {/* SHACL Violations */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('results.shacl')}
          </h3>
          {shaclReport.results.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const turtle = await exportSHACLReportAsTurtle(shaclReport, result.profile);
                  downloadFile(turtle, 'shacl-report.ttl', 'text/turtle');
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
                title={t('validation.downloadTurtle')}
              >
                <Download size={16} />
                Turtle
              </button>
              <button
                onClick={() => {
                  const csv = exportSHACLReportAsCSV(shaclReport.results);
                  downloadFile(csv, 'shacl-report.csv', 'text/csv');
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
                title={t('validation.downloadCSV')}
              >
                <Download size={16} />
                CSV
              </button>
            </div>
          )}
        </div>
        {shaclReport.results.length > 0 ? (
          <SHACLTable results={groupSimilarResults(shaclReport.results)} />
        ) : (
          <div className="text-center py-8 text-success">
            <CheckCircle2 className="mx-auto mb-2" size={48} />
            <p className="font-semibold">{t('shacl.noViolations')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
        {label}
      </p>
    </div>
  );
}
