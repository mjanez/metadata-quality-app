/**
 * Helper functions for translating metric details
 */

/**
 * Parse and translate a metric detail string
 * Details come in JSON format: { key: 'metricDetails.xxx', params: {...} }
 */
export function translateMetricDetail(
  detail: string | undefined,
  t: (key: string, params?: Record<string, any>) => string
): string {
  if (!detail) return '';
  
  try {
    const parsed = JSON.parse(detail);
    if (parsed.key) {
      return t(parsed.key, parsed.params);
    }
    return detail;
  } catch {
    // If it's not JSON, return as is (for backwards compatibility)
    return detail;
  }
}
