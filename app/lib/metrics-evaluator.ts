/**
 * MQA Metrics Evaluator
 * Implements proportional evaluation methodology for metadata quality assessment
 */

import { Store } from 'n3';
import type { ValidationProfile, DatasetStatistics } from '@/app/types';
import { NAMESPACES, getSubjectsByType, getObjectValue } from './rdf';
import {
  isMachineReadable,
  isNonProprietary,
  isKnownLicense,
  isKnownAccessRights,
  normalizeFormat,
} from './vocabularies';
import { checkUrlStatusBatch } from './url-status-client';
import { getUrlCheckConfig } from './url-check-config';

/**
 * Format metric detail message with translation key and parameters
 * Returns a JSON string that can be parsed by the UI layer for translation
 */
function formatMetricDetail(key: string, params?: Record<string, any>): string {
  return JSON.stringify({ key, params });
}

/**
 * Split URLs into chunks of specified size
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export interface MetricConfig {
  id: string;
  weight: number;
  property: string;
}

export interface MetricResult {
  id: string;
  name: string;
  value: number; // 0-100 percentage
  weight: number;
  passed: boolean;
  details?: string;
}

/**
 * Evaluate a single metric with proportional scoring
 */
export async function evaluateMetric(
  metricConfig: MetricConfig,
  store: Store,
  statistics: DatasetStatistics,
  profile: ValidationProfile
): Promise<MetricResult> {
  const { id, weight, property } = metricConfig;

  let value = 0;
  let passed = false;
  let details = '';

  switch (id) {
    // ===== FINDABILITY METRICS =====
    case 'dcat_keyword':
      ({ value, passed, details } = evaluateKeywordAvailability(store));
      break;

    case 'dcat_theme':
      ({ value, passed, details } = evaluateThemeAvailability(store));
      break;

    case 'dct_spatial':
      ({ value, passed, details } = evaluateSpatialAvailability(store));
      break;

    case 'dct_temporal':
      ({ value, passed, details } = evaluateTemporalAvailability(store));
      break;

    // ===== ACCESSIBILITY METRICS =====
    case 'dcat_access_url_status':
      ({ value, passed, details } = await evaluateAccessURLStatus(store));
      break;

    case 'dcat_download_url':
      ({ value, passed, details } = evaluateDownloadURLAvailability(store));
      break;

    case 'dcat_download_url_status':
      ({ value, passed, details } = await evaluateDownloadURLStatus(store));
      break;

    // ===== INTEROPERABILITY METRICS =====
    case 'dct_format':
      ({ value, passed, details } = evaluateFormatAvailability(store));
      break;

    case 'dcat_media_type':
      ({ value, passed, details } = evaluateMediaTypeAvailability(store));
      break;

    case 'dct_format_vocabulary':
    case 'dcat_media_type_vocabulary':
    case 'dct_format_vocabulary_nti_risp':
    case 'dcat_media_type_vocabulary_nti_risp':
      ({ value, passed, details } = await evaluateFormatMediaTypeVocabulary(store));
      break;

    case 'dct_format_nonproprietary':
      ({ value, passed, details } = await evaluateNonProprietaryFormat(store));
      break;

    case 'dct_format_machine_readable':
      ({ value, passed, details } = await evaluateMachineReadableFormat(store));
      break;

    case 'dcat_ap_compliance':
    case 'dcat_ap_es_compliance':
    case 'nti_risp_compliance':
      ({ value, passed, details } = { value: 100, passed: true, details: formatMetricDetail('metricDetails.shaclValidationPassed') });
      break;

    // ===== REUSABILITY METRICS =====
    case 'dct_license':
    case 'dct_license_nti_risp':
      ({ value, passed, details } = evaluateLicenseAvailability(store));
      break;

    case 'dct_license_vocabulary':
      ({ value, passed, details } = await evaluateLicenseVocabulary(store));
      break;

    case 'dct_access_rights':
      ({ value, passed, details } = evaluateAccessRightsAvailability(store));
      break;

    case 'dct_access_rights_vocabulary':
      ({ value, passed, details } = await evaluateAccessRightsVocabulary(store));
      break;

    case 'dcat_contact_point':
      ({ value, passed, details } = evaluateContactPointAvailability(store));
      break;

    case 'dct_publisher':
      ({ value, passed, details } = evaluatePublisherAvailability(store));
      break;

    // ===== CONTEXTUALITY METRICS =====
    case 'dcat_byte_size':
      ({ value, passed, details } = evaluateByteSizeAvailability(store));
      break;

    case 'dct_issued':
      ({ value, passed, details } = evaluateIssuedDateAvailability(store));
      break;

    case 'dct_modified':
      ({ value, passed, details } = evaluateModifiedDateAvailability(store));
      break;

    case 'dct_rights':
      ({ value, passed, details } = evaluateRightsAvailability(store));
      break;

    default:
      console.warn(`Unknown metric: ${id}`);
      value = 0;
      passed = false;
      details = formatMetricDetail('metricDetails.metricNotImplemented', { id });
  }

  return {
    id,
    name: id.replace(/_/g, ' ').toUpperCase(),
    value,
    weight,
    passed,
    details,
  };
}

// ===== FINDABILITY METRIC EVALUATORS =====

function evaluateKeywordAvailability(store: Store) {
  const datasets = getSubjectsByType(store, NAMESPACES.dcat + 'Dataset');
  if (datasets.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDatasetsFound') };
  }

  let datasetsWithKeywords = 0;
  for (const dataset of datasets) {
    const keywords = store.getQuads(dataset, NAMESPACES.dcat + 'keyword', null, null);
    if (keywords.length > 0) {
      datasetsWithKeywords++;
    }
  }

  const percentage = (datasetsWithKeywords / datasets.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.datasetsHaveKeywords', { count: datasetsWithKeywords, total: datasets.length }),
  };
}

function evaluateThemeAvailability(store: Store) {
  const datasets = getSubjectsByType(store, NAMESPACES.dcat + 'Dataset');
  if (datasets.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDatasetsFound') };
  }

  let datasetsWithTheme = 0;
  for (const dataset of datasets) {
    const themes = store.getQuads(dataset, NAMESPACES.dcat + 'theme', null, null);
    if (themes.length > 0) {
      datasetsWithTheme++;
    }
  }

  const percentage = (datasetsWithTheme / datasets.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.datasetsHaveThemes', { count: datasetsWithTheme, total: datasets.length }),
  };
}

function evaluateSpatialAvailability(store: Store) {
  const datasets = getSubjectsByType(store, NAMESPACES.dcat + 'Dataset');
  if (datasets.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDatasetsFound') };
  }

  let datasetsWithSpatial = 0;
  for (const dataset of datasets) {
    const spatial = store.getQuads(dataset, NAMESPACES.dct + 'spatial', null, null);
    if (spatial.length > 0) {
      datasetsWithSpatial++;
    }
  }

  const percentage = (datasetsWithSpatial / datasets.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.datasetsHaveSpatialCoverage', { count: datasetsWithSpatial, total: datasets.length }),
  };
}

function evaluateTemporalAvailability(store: Store) {
  const datasets = getSubjectsByType(store, NAMESPACES.dcat + 'Dataset');
  if (datasets.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDatasetsFound') };
  }

  let datasetsWithTemporal = 0;
  for (const dataset of datasets) {
    const temporal = store.getQuads(dataset, NAMESPACES.dct + 'temporal', null, null);
    if (temporal.length > 0) {
      datasetsWithTemporal++;
    }
  }

  const percentage = (datasetsWithTemporal / datasets.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.datasetsHaveTemporalCoverage', { count: datasetsWithTemporal, total: datasets.length }),
  };
}

// ===== ACCESSIBILITY METRIC EVALUATORS =====

async function evaluateAccessURLStatus(store: Store) {
  const distributions = getSubjectsByType(store, NAMESPACES.dcat + 'Distribution');
  if (distributions.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDistributionsFound') };
  }

  // Collect all accessURLs
  const urlsToCheck: string[] = [];
  
  for (const dist of distributions) {
    const accessURL = getObjectValue(store, dist, NAMESPACES.dcat + 'accessURL');
    if (accessURL && (accessURL.startsWith('http://') || accessURL.startsWith('https://'))) {
      urlsToCheck.push(accessURL);
    }
  }

  if (urlsToCheck.length === 0) {
    return {
      value: 0,
      passed: false,
      details: formatMetricDetail('metricDetails.noDistributionsWithAccessURL'),
    };
  }

  // Check if URL checking is enabled
  const config = getUrlCheckConfig();
  if (!config.enabled) {
    // If disabled, just check existence (not actual accessibility)
    const percentage = (urlsToCheck.length / distributions.length) * 100;
    return {
      value: percentage,
      passed: urlsToCheck.length > 0,
      details: formatMetricDetail('metricDetails.distributionsHaveAccessURLNotChecked', { count: urlsToCheck.length, total: distributions.length }),
    };
  }

  // Split URLs into chunks of 50 (API limit)
  const urlChunks = chunkArray(urlsToCheck, 50);
  
  // Check all chunks in sequence
  const allResults = [];
  for (const chunk of urlChunks) {
    const chunkResults = await checkUrlStatusBatch(chunk, config.timeout);
    allResults.push(...chunkResults);
  }
  
  const resultMap = new Map(allResults.map(r => [r.url, r]));

  // Count accessible URLs
  let accessibleCount = 0;
  for (const url of urlsToCheck) {
    const result = resultMap.get(url);
    if (result?.accessible) {
      accessibleCount++;
    }
  }

  const percentage = (accessibleCount / distributions.length) * 100;
  return {
    value: percentage,
    passed: accessibleCount > 0,
    details: formatMetricDetail('metricDetails.distributionsHaveAccessURL', { count: accessibleCount, total: distributions.length }),
  };
}

function evaluateDownloadURLAvailability(store: Store) {
  const distributions = getSubjectsByType(store, NAMESPACES.dcat + 'Distribution');
  if (distributions.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDistributionsFound') };
  }

  let distributionsWithDownloadURL = 0;
  for (const dist of distributions) {
    const downloadURL = getObjectValue(store, dist, NAMESPACES.dcat + 'downloadURL');
    if (downloadURL) {
      distributionsWithDownloadURL++;
    }
  }

  const percentage = (distributionsWithDownloadURL / distributions.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.distributionsHaveDownloadURL', { count: distributionsWithDownloadURL, total: distributions.length }),
  };
}

async function evaluateDownloadURLStatus(store: Store) {
  const distributions = getSubjectsByType(store, NAMESPACES.dcat + 'Distribution');
  if (distributions.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDistributionsFound') };
  }

  // Collect all downloadURLs
  const urlsToCheck: string[] = [];
  
  for (const dist of distributions) {
    const downloadURL = getObjectValue(store, dist, NAMESPACES.dcat + 'downloadURL');
    if (downloadURL && (downloadURL.startsWith('http://') || downloadURL.startsWith('https://'))) {
      urlsToCheck.push(downloadURL);
    }
  }

  if (urlsToCheck.length === 0) {
    return {
      value: 0,
      passed: false,
      details: formatMetricDetail('metricDetails.noDistributionsWithDownloadURL'),
    };
  }

  // Check if URL checking is enabled
  const config = getUrlCheckConfig();
  if (!config.enabled) {
    // If disabled, just check existence (not actual accessibility)
    const percentage = (urlsToCheck.length / distributions.length) * 100;
    return {
      value: percentage,
      passed: urlsToCheck.length > 0,
      details: formatMetricDetail('metricDetails.distributionsHaveDownloadURL', { count: urlsToCheck.length, total: distributions.length }),
    };
  }

  // Split URLs into chunks of 50 (API limit)
  const urlChunks = chunkArray(urlsToCheck, 50);
  
  // Check all chunks in sequence
  const allResults = [];
  for (const chunk of urlChunks) {
    const chunkResults = await checkUrlStatusBatch(chunk, config.timeout);
    allResults.push(...chunkResults);
  }
  
  const resultMap = new Map(allResults.map(r => [r.url, r]));

  // Count accessible URLs
  let accessibleCount = 0;
  for (const url of urlsToCheck) {
    const result = resultMap.get(url);
    if (result?.accessible) {
      accessibleCount++;
    }
  }

  const percentage = (accessibleCount / urlsToCheck.length) * 100;
  return {
    value: percentage,
    passed: accessibleCount > 0,
    details: formatMetricDetail('metricDetails.downloadURLsAccessible', { count: accessibleCount, total: urlsToCheck.length }),
  };
}

// ===== INTEROPERABILITY METRIC EVALUATORS =====

function evaluateFormatAvailability(store: Store) {
  const distributions = getSubjectsByType(store, NAMESPACES.dcat + 'Distribution');
  if (distributions.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDistributionsFound') };
  }

  let distributionsWithFormat = 0;
  for (const dist of distributions) {
    const format = getObjectValue(store, dist, NAMESPACES.dct + 'format');
    if (format) {
      distributionsWithFormat++;
    }
  }

  const percentage = (distributionsWithFormat / distributions.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.distributionsHaveFormat', { count: distributionsWithFormat, total: distributions.length }),
  };
}

function evaluateMediaTypeAvailability(store: Store) {
  const distributions = getSubjectsByType(store, NAMESPACES.dcat + 'Distribution');
  if (distributions.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDistributionsFound') };
  }

  let distributionsWithMediaType = 0;
  for (const dist of distributions) {
    const mediaType = getObjectValue(store, dist, NAMESPACES.dcat + 'mediaType');
    if (mediaType) {
      distributionsWithMediaType++;
    }
  }

  const percentage = (distributionsWithMediaType / distributions.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.distributionsHaveMediaType', { count: distributionsWithMediaType, total: distributions.length }),
  };
}

async function evaluateFormatMediaTypeVocabulary(store: Store) {
  const distributions = getSubjectsByType(store, NAMESPACES.dcat + 'Distribution');
  if (distributions.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDistributionsFound') };
  }

  let distributionsWithKnownFormat = 0;
  for (const dist of distributions) {
    const format = getObjectValue(store, dist, NAMESPACES.dct + 'format');
    const mediaType = getObjectValue(store, dist, NAMESPACES.dcat + 'mediaType');
    
    // Check if format or mediaType is a known value
    if ((format && normalizeFormat(format).includes('/')) || 
        (mediaType && mediaType.includes('/'))) {
      distributionsWithKnownFormat++;
    }
  }

  const percentage = (distributionsWithKnownFormat / distributions.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.distributionsUseKnownFormat', { count: distributionsWithKnownFormat, total: distributions.length }),
  };
}

async function evaluateNonProprietaryFormat(store: Store) {
  const distributions = getSubjectsByType(store, NAMESPACES.dcat + 'Distribution');
  if (distributions.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDistributionsFound') };
  }

  let distributionsWithNonProprietary = 0;
  for (const dist of distributions) {
    const format = getObjectValue(store, dist, NAMESPACES.dct + 'format');
    if (format && await isNonProprietary(format)) {
      distributionsWithNonProprietary++;
    }
  }

  const percentage = (distributionsWithNonProprietary / distributions.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.distributionsUseNonProprietary', { count: distributionsWithNonProprietary, total: distributions.length }),
  };
}

async function evaluateMachineReadableFormat(store: Store) {
  const distributions = getSubjectsByType(store, NAMESPACES.dcat + 'Distribution');
  if (distributions.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDistributionsFound') };
  }

  let distributionsWithMachineReadable = 0;
  for (const dist of distributions) {
    const format = getObjectValue(store, dist, NAMESPACES.dct + 'format');
    if (format && await isMachineReadable(format)) {
      distributionsWithMachineReadable++;
    }
  }

  const percentage = (distributionsWithMachineReadable / distributions.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.distributionsAreMachineReadable', { count: distributionsWithMachineReadable, total: distributions.length }),
  };
}

// ===== REUSABILITY METRIC EVALUATORS =====

function evaluateLicenseAvailability(store: Store) {
  const distributions = getSubjectsByType(store, NAMESPACES.dcat + 'Distribution');
  if (distributions.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDistributionsFound') };
  }

  let distributionsWithLicense = 0;
  for (const dist of distributions) {
    const license = getObjectValue(store, dist, NAMESPACES.dct + 'license');
    if (license) {
      distributionsWithLicense++;
    }
  }

  const percentage = (distributionsWithLicense / distributions.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.distributionsHaveLicense', { count: distributionsWithLicense, total: distributions.length }),
  };
}

async function evaluateLicenseVocabulary(store: Store) {
  const distributions = getSubjectsByType(store, NAMESPACES.dcat + 'Distribution');
  if (distributions.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDistributionsFound') };
  }

  let distributionsWithKnownLicense = 0;
  for (const dist of distributions) {
    const license = getObjectValue(store, dist, NAMESPACES.dct + 'license');
    if (license && await isKnownLicense(license)) {
      distributionsWithKnownLicense++;
    }
  }

  const percentage = (distributionsWithKnownLicense / distributions.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.distributionsUseKnownLicense', { count: distributionsWithKnownLicense, total: distributions.length }),
  };
}

function evaluateAccessRightsAvailability(store: Store) {
  const datasets = getSubjectsByType(store, NAMESPACES.dcat + 'Dataset');
  if (datasets.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDatasetsFound') };
  }

  let datasetsWithAccessRights = 0;
  for (const dataset of datasets) {
    const accessRights = getObjectValue(store, dataset, NAMESPACES.dct + 'accessRights');
    if (accessRights) {
      datasetsWithAccessRights++;
    }
  }

  const percentage = (datasetsWithAccessRights / datasets.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.datasetsHaveAccessRights', { count: datasetsWithAccessRights, total: datasets.length }),
  };
}

async function evaluateAccessRightsVocabulary(store: Store) {
  const datasets = getSubjectsByType(store, NAMESPACES.dcat + 'Dataset');
  if (datasets.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDatasetsFound') };
  }

  let datasetsWithKnownAccessRights = 0;
  for (const dataset of datasets) {
    const accessRights = getObjectValue(store, dataset, NAMESPACES.dct + 'accessRights');
    if (accessRights && await isKnownAccessRights(accessRights)) {
      datasetsWithKnownAccessRights++;
    }
  }

  const percentage = (datasetsWithKnownAccessRights / datasets.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.datasetsUseKnownAccessRights', { count: datasetsWithKnownAccessRights, total: datasets.length }),
  };
}

function evaluateContactPointAvailability(store: Store) {
  const datasets = getSubjectsByType(store, NAMESPACES.dcat + 'Dataset');
  if (datasets.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDatasetsFound') };
  }

  let datasetsWithContactPoint = 0;
  for (const dataset of datasets) {
    const contactPoint = getObjectValue(store, dataset, NAMESPACES.dcat + 'contactPoint');
    if (contactPoint) {
      datasetsWithContactPoint++;
    }
  }

  const percentage = (datasetsWithContactPoint / datasets.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.datasetsHaveContactPoint', { count: datasetsWithContactPoint, total: datasets.length }),
  };
}

function evaluatePublisherAvailability(store: Store) {
  const datasets = getSubjectsByType(store, NAMESPACES.dcat + 'Dataset');
  if (datasets.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDatasetsFound') };
  }

  let datasetsWithPublisher = 0;
  for (const dataset of datasets) {
    const publisher = getObjectValue(store, dataset, NAMESPACES.dct + 'publisher');
    if (publisher) {
      datasetsWithPublisher++;
    }
  }

  const percentage = (datasetsWithPublisher / datasets.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.datasetsHavePublisher', { count: datasetsWithPublisher, total: datasets.length }),
  };
}

// ===== CONTEXTUALITY METRIC EVALUATORS =====

function evaluateByteSizeAvailability(store: Store) {
  const distributions = getSubjectsByType(store, NAMESPACES.dcat + 'Distribution');
  if (distributions.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDistributionsFound') };
  }

  let distributionsWithByteSize = 0;
  for (const dist of distributions) {
    const byteSize = getObjectValue(store, dist, NAMESPACES.dcat + 'byteSize');
    if (byteSize) {
      distributionsWithByteSize++;
    }
  }

  const percentage = (distributionsWithByteSize / distributions.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.distributionsHaveByteSize', { count: distributionsWithByteSize, total: distributions.length }),
  };
}

function evaluateIssuedDateAvailability(store: Store) {
  const datasets = getSubjectsByType(store, NAMESPACES.dcat + 'Dataset');
  if (datasets.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDatasetsFound') };
  }

  let entitiesWithIssued = 0;
  let totalEntities = datasets.length;

  for (const dataset of datasets) {
    const issued = getObjectValue(store, dataset, NAMESPACES.dct + 'issued');
    if (issued) {
      entitiesWithIssued++;
    }
  }

  const percentage = (entitiesWithIssued / totalEntities) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.entitiesHaveIssuedDate', { count: entitiesWithIssued, total: totalEntities }),
  };
}

function evaluateModifiedDateAvailability(store: Store) {
  const datasets = getSubjectsByType(store, NAMESPACES.dcat + 'Dataset');
  if (datasets.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDatasetsFound') };
  }

  let entitiesWithModified = 0;
  let totalEntities = datasets.length;

  for (const dataset of datasets) {
    const modified = getObjectValue(store, dataset, NAMESPACES.dct + 'modified');
    if (modified) {
      entitiesWithModified++;
    }
  }

  const percentage = (entitiesWithModified / totalEntities) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.entitiesHaveModifiedDate', { count: entitiesWithModified, total: totalEntities }),
  };
}

function evaluateRightsAvailability(store: Store) {
  const distributions = getSubjectsByType(store, NAMESPACES.dcat + 'Distribution');
  if (distributions.length === 0) {
    return { value: 0, passed: false, details: formatMetricDetail('metricDetails.noDistributionsFound') };
  }

  let distributionsWithRights = 0;
  for (const dist of distributions) {
    const rights = getObjectValue(store, dist, NAMESPACES.dct + 'rights');
    if (rights) {
      distributionsWithRights++;
    }
  }

  const percentage = (distributionsWithRights / distributions.length) * 100;
  return {
    value: percentage,
    passed: percentage > 0,
    details: formatMetricDetail('metricDetails.distributionsHaveRights', { count: distributionsWithRights, total: distributions.length }),
  };
}
