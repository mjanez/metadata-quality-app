import { Store } from 'n3';
import type {
  ValidationProfile,
  QualityAssessment,
  QualityDimension,
  QualityMetric,
  DatasetStatistics,
} from '@/app/types';
import { getSubjectsByType, getObjects } from './rdf';
import { getProfileMetrics, getProfileDimensions, getMaxScore } from './config';
import { evaluateMetric } from './metrics-evaluator';

/**
 * Calculate dataset statistics
 */
export function calculateStatistics(store: Store): DatasetStatistics {
  const NAMESPACES = {
    dcat: 'http://www.w3.org/ns/dcat#',
    dct: 'http://purl.org/dc/terms/',
  };
  const datasets = getSubjectsByType(store, NAMESPACES.dcat + 'Dataset');
  const distributions = getSubjectsByType(store, NAMESPACES.dcat + 'Distribution');
  const dataServices = getSubjectsByType(store, NAMESPACES.dcat + 'DataService');
  let keywordsCount = 0;
  let licensesCount = 0;
  let accessRightsCount = 0;
  let contactPointsCount = 0;
  let spatialCount = 0;
  let temporalCount = 0;
  datasets.forEach(datasetUri => {
    keywordsCount += getObjects(store, datasetUri, NAMESPACES.dcat + 'keyword').length;
    const license = getObjects(store, datasetUri, NAMESPACES.dct + 'license');
    if (license.length > 0) licensesCount++;
    const accessRights = getObjects(store, datasetUri, NAMESPACES.dct + 'accessRights');
    if (accessRights.length > 0) accessRightsCount++;
    const contactPoint = getObjects(store, datasetUri, NAMESPACES.dcat + 'contactPoint');
    contactPointsCount += contactPoint.length;
    const spatial = getObjects(store, datasetUri, NAMESPACES.dct + 'spatial');
    if (spatial.length > 0) spatialCount++;
    const temporal = getObjects(store, datasetUri, NAMESPACES.dct + 'temporal');
    if (temporal.length > 0) temporalCount++;
  });
  return {
    datasetsCount: datasets.length,
    distributionsCount: distributions.length,
    dataServicesCount: dataServices.length,
    keywordsCount,
    licensesCount,
    accessRightsCount,
    contactPointsCount,
    spatialCount,
    temporalCount,
  };
}

/**
 * Calculate quality assessment for RDF data with dynamic configuration and vocabulary-aware metrics
 */
export async function calculateQuality(
  store: Store,
  profile: ValidationProfile
): Promise<QualityAssessment> {
  const statistics = calculateStatistics(store);
  const dimensionsConfig = await getProfileDimensions(profile);
  const maxScore = await getMaxScore(profile);
  if (!dimensionsConfig) {
    throw new Error(`Profile ${profile} not found in configuration`);
  }

  // Dynamically calculate all dimensions from config
  const dimensionNames = Object.keys(dimensionsConfig);
  const dimensions: Record<string, QualityDimension> = {};
  for (const dimName of dimensionNames) {
    dimensions[dimName] = await calculateDimension(store, statistics, profile, dimName);
  }

  // Calculate overall score from dimensions (sum of actual scores)
  // Each dimension.score is already scaled to its maxScore
  let totalScore = 0;
  for (const dimName of dimensionNames) {
    const dim = dimensions[dimName];
    totalScore += dim.score; // Already in points (0 to dimMaxScore)
  }

  // Map to expected output structure (with named keys)
  const outputDimensions = {
    findability: dimensions['findability'],
    accessibility: dimensions['accessibility'],
    interoperability: dimensions['interoperability'],
    reusability: dimensions['reusability'],
    contextuality: dimensions['contextuality'] || dimensions['contextuality'],
  };

  return {
    overallScore: Math.round(totalScore),
    maxScore,
    dimensions: outputDimensions,
    timestamp: Date.now(),
  };
}

/**
 * Generic function to calculate any dimension based on configuration and metrics-evaluator
 */
async function calculateDimension(
  store: Store,
  statistics: DatasetStatistics,
  profile: ValidationProfile,
  dimensionName: string
): Promise<QualityDimension> {
  const metricsConfig = await getProfileMetrics(profile, dimensionName);
  const dimensionsConfig = await getProfileDimensions(profile);
  const dimensionMaxScore = dimensionsConfig?.[dimensionName]?.maxScore || 0;
  
  const metrics: QualityMetric[] = [];
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const metricConfig of metricsConfig) {
    const metricResult = await evaluateMetric(metricConfig, store, statistics, profile);
    metrics.push(metricResult);
    
    // Weighted sum: each metric contributes its percentage * its weight
    weightedSum += metricResult.value * metricConfig.weight;
    totalWeight += metricConfig.weight;
  }
  
  // Calculate dimension percentage (0-100%)
  const dimensionPercentage = totalWeight > 0 ? (weightedSum / totalWeight) : 0;
  
  // Calculate actual score (percentage of maxScore)
  const actualScore = (dimensionPercentage / 100) * dimensionMaxScore;
  
  return {
    name: dimensionName.charAt(0).toUpperCase() + dimensionName.slice(1),
    score: actualScore, // Actual points (0 to maxScore)
    weight: dimensionMaxScore, // Use maxScore as weight for dimension
    metrics,
  };
}