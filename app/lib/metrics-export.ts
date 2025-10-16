/**
 * Export quality metrics to CSV format
 */

import type { QualityAssessment } from '@/app/types';

/**
 * Export quality metrics as CSV
 */
export function exportMetricsAsCSV(
  assessment: QualityAssessment,
  t: (key: string, params?: Record<string, any>) => string
): string {
  const lines: string[] = [];
  
  // Header
  lines.push('Dimension,Metric,Score (%),Weight,Passed,Details');
  
  // Process each dimension
  const dimensions = [
    { key: 'findability', data: assessment.dimensions.findability },
    { key: 'accessibility', data: assessment.dimensions.accessibility },
    { key: 'interoperability', data: assessment.dimensions.interoperability },
    { key: 'reusability', data: assessment.dimensions.reusability },
    { key: 'contextuality', data: assessment.dimensions.contextuality },
  ];
  
  dimensions.forEach(({ key, data }) => {
    const dimensionName = t(`quality.${key}`);
    
    data.metrics.forEach(metric => {
      // Escape values for CSV
      const details = metric.details 
        ? `"${metric.details.replace(/"/g, '""')}"` 
        : '';
      
      lines.push([
        dimensionName,
        metric.name,
        Math.round(metric.value * 100) / 100,
        metric.weight,
        metric.passed ? 'Yes' : 'No',
        details
      ].join(','));
    });
  });
  
  // Add summary row
  lines.push('');
  lines.push(`Overall Score,${Math.round(assessment.overallScore)}%`);
  
  return lines.join('\n');
}

/**
 * Download metrics as CSV file
 */
export function downloadMetricsCSV(
  assessment: QualityAssessment,
  t: (key: string, params?: Record<string, any>) => string,
  filename: string = 'quality-metrics.csv'
): void {
  const csv = exportMetricsAsCSV(assessment, t);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
