'use client';

import { useState, useCallback } from 'react';
import type {
  ValidationInput,
  ValidationProfile,
  ValidationResult,
  RDFFormat,
} from '@/app/types';
import { parseRDF, detectFormat } from '@/app/lib/rdf';
import { validateSHACL } from '@/app/lib/shacl';
import { calculateQuality, calculateStatistics } from '@/app/lib/quality';
import { downloadData } from '@/app/lib/api-client';

/**
 * Hook for managing validation state and orchestration
 */
export function useValidation() {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  /**
   * Main validation function
   */
  const validate = useCallback(async (
    input: ValidationInput,
    profile: ValidationProfile
  ) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    try {
      // Step 1: Get RDF content
      setProgress('Preparing data...');
      let rdfContent = '';
      
      if (input.type === 'text') {
        rdfContent = input.content || '';
        if (!rdfContent.trim()) {
          throw new Error('No RDF content to validate');
        }
      } else if (input.type === 'url') {
        const urlToFetch = input.url?.trim();
        if (!urlToFetch) {
          throw new Error('Please enter a valid URL');
        }
        
        setProgress('Downloading from URL...');
        const downloadResult = await downloadData(urlToFetch);
        
        if (!downloadResult.success || !downloadResult.data) {
          throw new Error(downloadResult.error || 'Failed to download data from URL');
        }
        
        rdfContent = downloadResult.data.data;
        if (!rdfContent.trim()) {
          throw new Error('Downloaded content is empty or invalid');
        }
      }
      
      // Step 2: Parse RDF
      setProgress('Parsing RDF...');
      const format: RDFFormat = detectFormat(rdfContent);
      const store = await parseRDF(rdfContent, format);
      
      if (store.size === 0) {
        throw new Error('No RDF triples found in the content');
      }
      
      // Step 3: SHACL Validation
      setProgress('Running SHACL validation...');
      const shaclReport = await validateSHACL(store, profile);
      
      // Step 4: Calculate Quality Metrics
      setProgress('Calculating quality metrics...');
      const qualityAssessment = await calculateQuality(store, profile);
      const statistics = calculateStatistics(store);
      
      // Step 5: Build result
      const validationResult: ValidationResult = {
        profile,
        format,
        shaclReport,
        qualityAssessment,
        statistics,
        timestamp: Date.now(),
      };
      
      setResult(validationResult);
      setProgress('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Validation failed';
      setError(errorMessage);
      console.error('Validation error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * Clear validation results
   */
  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setProgress('');
  }, []);
  
  return {
    result,
    isLoading,
    progress,
    error,
    validate,
    clear,
  };
}
