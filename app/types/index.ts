/**
 * RDF Format types
 */
export type RDFFormat = 'turtle' | 'rdfxml' | 'jsonld' | 'ntriples' | 'nquads';

/**
 * Validation profiles
 */
export type ValidationProfile = 'dcat_ap' | 'dcat_ap_es' | 'nti_risp';

/**
 * SHACL Severity levels
 */
export type SHACLSeverity = 'Violation' | 'Warning' | 'Info';

/**
 * Input types for validation
 */
export type ValidationInputType = 'text' | 'url';

/**
 * Validation input
 */
export interface ValidationInput {
  type: ValidationInputType;
  content?: string;
  url?: string;
}

/**
 * SHACL Validation Result
 */
export interface SHACLResult {
  severity: SHACLSeverity;
  focusNode: string;
  path?: string;
  message: string;
  value?: string;
  sourceConstraintComponent?: string;
  sourceShape?: string;
}

/**
 * Grouped SHACL Result (for aggregating similar violations)
 */
export interface GroupedSHACLResult {
  severity: SHACLSeverity;
  path: string;
  message: string;
  count: number;
  focusNodes: string[];
  examples: SHACLResult[];
}

/**
 * SHACL Validation Report
 */
export interface SHACLReport {
  conforms: boolean;
  results: SHACLResult[];
  profile?: ValidationProfile;
}

/**
 * Quality Dimension
 */
export interface QualityDimension {
  name: string;
  score: number;
  weight: number;
  metrics: QualityMetric[];
}

/**
 * Quality Metric
 */
export interface QualityMetric {
  id: string;
  name: string;
  value: number;
  weight: number;
  passed: boolean;
  details?: string;
}

/**
 * Quality Assessment
 */
export interface QualityAssessment {
  overallScore: number;
  maxScore: number;
  dimensions: {
    findability: QualityDimension;
    accessibility: QualityDimension;
    interoperability: QualityDimension;
    reusability: QualityDimension;
    contextuality: QualityDimension;
  };
  timestamp: number;
}

/**
 * Dataset Statistics
 */
export interface DatasetStatistics {
  datasetsCount: number;
  distributionsCount: number;
  dataServicesCount: number;
  keywordsCount: number;
  licensesCount: number;
  accessRightsCount: number;
  contactPointsCount: number;
  spatialCount: number;
  temporalCount: number;
}

/**
 * Complete Validation Result
 */
export interface ValidationResult {
  profile: ValidationProfile;
  format: RDFFormat;
  shaclReport: SHACLReport;
  qualityAssessment: QualityAssessment;
  statistics: DatasetStatistics;
  timestamp: number;
  errors?: string[];
}

/**
 * MQA Configuration Profile
 */
export interface MQAConfigProfile {
  id: string;
  name: string;
  version: string;
  description: string;
  shaclShapesUrl: string;
  dimensions: {
    [key: string]: {
      weight: number;
      metrics: {
        [key: string]: {
          weight: number;
          sparql?: string;
          threshold?: number;
        };
      };
    };
  };
}

/**
 * MQA Configuration
 */
export interface MQAConfig {
  profiles: {
    [key: string]: MQAConfigProfile;
  };
  vocabularies: {
    [key: string]: string;
  };
}

/**
 * API Response wrapper
 */
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Download data response
 */
export interface DownloadDataResponse {
  data: string;
  contentType: string;
  url: string;
}

/**
 * Validate URL response
 */
export interface ValidateURLResponse {
  accessible: boolean;
  contentType?: string;
  error?: string;
}
