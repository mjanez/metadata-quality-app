/**
 * URL Status Check Configuration
 * Allows enabling/disabling URL accessibility checks and setting timeout
 */

export interface UrlCheckConfig {
  enabled: boolean;
  timeout: number;
  showProgress: boolean;
}

const DEFAULT_CONFIG: UrlCheckConfig = {
  enabled: true,
  timeout: 3000, // 3 seconds - reduced for faster validation
  showProgress: false,
};

let currentConfig: UrlCheckConfig = { ...DEFAULT_CONFIG };

/**
 * Get current URL check configuration
 */
export function getUrlCheckConfig(): UrlCheckConfig {
  return { ...currentConfig };
}

/**
 * Update URL check configuration
 */
export function setUrlCheckConfig(config: Partial<UrlCheckConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Reset to default configuration
 */
export function resetUrlCheckConfig(): void {
  currentConfig = { ...DEFAULT_CONFIG };
}

/**
 * Check if URL checking is enabled
 */
export function isUrlCheckEnabled(): boolean {
  return currentConfig.enabled;
}
