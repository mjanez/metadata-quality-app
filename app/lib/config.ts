/**
 * MQA Configuration Module
 * Loads and manages MQA (Metadata Quality Assessment) configuration
 * Based on data.europa.eu MQA methodology
 */

export interface MQAMetric {
  id: string;
  weight: number;
  property: string;
}

export interface MQADimension {
  maxScore: number;
}

export interface MQAProfileVersion {
  name: string;
  maxScore: number;
  icon: string;
  url: string;
  sampleUrl: string;
  shaclFiles: string[];
  dimensions: {
    findability: MQADimension;
    accessibility: MQADimension;
    interoperability: MQADimension;
    reusability: MQADimension;
    contextuality: MQADimension;
  };
}

export interface MQAProfile {
  versions: Record<string, MQAProfileVersion>;
  defaultVersion: string;
}

export interface MQAConfig {
  profiles: Record<string, MQAProfile>;
  profile_metrics: Record<string, Record<string, MQAMetric[]>>;
  evaluationSettings: {
    useProportionalEvaluation: boolean;
    minimumEntityThreshold: number;
    description: string;
  };
  backend_server: {
    enabled: boolean;
    url: string;
    endpoints: Record<string, string>;
    cors_proxy: {
      fallback_proxies: string[];
      enable_heuristics: boolean;
    };
  };
  vocabularies: Record<string, string>;
  app_info: {
    name: string;
    version: string;
    repository: string;
    description: string;
  };
}

let cachedConfig: MQAConfig | null = null;

/**
 * Load MQA configuration from public JSON file
 */
async function loadConfig(): Promise<MQAConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const response = await fetch('/mqa-config.json');
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.statusText}`);
    }
    cachedConfig = await response.json();
    return cachedConfig as MQAConfig;
  } catch (error) {
    console.error('Error loading MQA configuration:', error);
    throw error;
  }
}

/**
 * Get MQA configuration (async)
 */
export async function getConfig(): Promise<MQAConfig> {
  return loadConfig();
}

/**
 * Get configuration for a specific profile and version
 */
export async function getProfileConfig(
  profileId: string,
  version?: string
): Promise<MQAProfileVersion | null> {
  const config = await getConfig();
  const profile = config.profiles[profileId];
  
  if (!profile) {
    return null;
  }

  const targetVersion = version || profile.defaultVersion;
  return profile.versions[targetVersion] || null;
}

/**
 * Get metrics for a specific profile and dimension
 */
export async function getProfileMetrics(
  profileId: string,
  dimension: string
): Promise<MQAMetric[]> {
  const config = await getConfig();
  const profileMetrics = config.profile_metrics[profileId];
  
  if (!profileMetrics) {
    return [];
  }

  return profileMetrics[dimension] || [];
}

/**
 * Get all metrics for a profile (all dimensions)
 */
export async function getAllProfileMetrics(
  profileId: string
): Promise<Record<string, MQAMetric[]>> {
  const config = await getConfig();
  return config.profile_metrics[profileId] || {};
}

/**
 * Get all dimensions for a profile
 */
export async function getProfileDimensions(
  profileId: string,
  version?: string
): Promise<Record<string, MQADimension> | null> {
  const profileConfig = await getProfileConfig(profileId, version);
  return profileConfig?.dimensions || null;
}

/**
 * Calculate maximum possible score for a profile
 */
export async function getMaxScore(profileId: string, version?: string): Promise<number> {
  const profileConfig = await getProfileConfig(profileId, version);
  return profileConfig?.maxScore || 0;
}

/**
 * Get SHACL files URLs for validation
 */
export async function getShaclFiles(profileId: string, version?: string): Promise<string[]> {
  const profileConfig = await getProfileConfig(profileId, version);
  return profileConfig?.shaclFiles || [];
}

/**
 * Get backend server configuration
 */
export async function getBackendConfig() {
  const config = await getConfig();
  return config.backend_server;
}

/**
 * Get vocabulary URL
 */
export async function getVocabularyUrl(vocabularyName: string): Promise<string> {
  const config = await getConfig();
  return config.vocabularies[vocabularyName] || '';
}

/**
 * Get all available profiles
 */
export async function getAvailableProfiles(): Promise<Array<{ id: string; name: string; version: string }>> {
  const config = await getConfig();
  const profiles: Array<{ id: string; name: string; version: string }> = [];
  
  Object.entries(config.profiles).forEach(([profileId, profile]) => {
    const defaultVersion = profile.defaultVersion;
    const versionConfig = profile.versions[defaultVersion];
    
    if (versionConfig) {
      profiles.push({
        id: profileId,
        name: versionConfig.name,
        version: defaultVersion,
      });
    }
  });
  
  return profiles;
}

/**
 * Get evaluation settings
 */
export async function getEvaluationSettings() {
  const config = await getConfig();
  return config.evaluationSettings;
}
