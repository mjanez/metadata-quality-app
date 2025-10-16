import { Store, DataFactory } from 'n3';
import type { SHACLReport, SHACLResult, SHACLSeverity, ValidationProfile, GroupedSHACLResult } from '@/app/types';
import { parseRDF } from './rdf';
import { getProfileConfig } from './config';
// @ts-ignore - shacl-engine imports
import Validator from 'shacl-engine/Validator.js';
// @ts-ignore
import { validations as sparqlValidations } from 'shacl-engine/sparql.js';
// @ts-ignore - rdf-ext provides full RDF/JS factory
import rdf from 'rdf-ext';

/**
 * Load SHACL shapes for a profile from configuration
 */
async function loadSHACLShapes(profile: ValidationProfile): Promise<Store> {
  const config = await getProfileConfig(profile);
  
  if (!config) {
    throw new Error(`Profile ${profile} not found in configuration`);
  }
  
  const shaclFiles = config.shaclFiles || [];
  
  if (shaclFiles.length === 0) {
    console.warn(`No SHACL files configured for profile ${profile}, using minimal shapes`);
    return loadMinimalShapes();
  }
  
  try {
    // Load all SHACL files and merge into a single store
    const allShapes = await Promise.all(
      shaclFiles.map(url => fetchAndParseSHACL(url))
    );
    
    // Merge all stores
    const mergedStore = allShapes[0];
    for (let i = 1; i < allShapes.length; i++) {
      const quads = allShapes[i].getQuads(null, null, null, null);
      mergedStore.addQuads(quads);
    }
    
    console.log(`Loaded ${mergedStore.size} SHACL triples from ${shaclFiles.length} files for ${profile}`);
    return mergedStore;
    
  } catch (error) {
    console.error(`Error loading SHACL shapes for ${profile}:`, error);
    console.warn('Falling back to minimal SHACL shapes');
    return loadMinimalShapes();
  }
}

/**
 * Fetch and parse SHACL file from URL
 */
async function fetchAndParseSHACL(url: string): Promise<Store> {
  try {
    console.log(`Fetching SHACL from: ${url}`);
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/turtle, application/rdf+xml, application/ld+json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const content = await response.text();
    
    // Detect format from URL or content-type
    let format: 'turtle' | 'rdfxml' | 'jsonld' = 'turtle';
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('rdf+xml') || url.endsWith('.rdf')) {
      format = 'rdfxml';
    } else if (contentType.includes('ld+json') || url.endsWith('.jsonld')) {
      format = 'jsonld';
    }
    
    return parseRDF(content, format);
    
  } catch (error) {
    throw new Error(`Failed to fetch SHACL from ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load minimal fallback SHACL shapes
 */
async function loadMinimalShapes(): Promise<Store> {
  const minimalShapes = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix dcat: <http://www.w3.org/ns/dcat#> .
    @prefix dct: <http://purl.org/dc/terms/> .
    
    # Basic DCAT-AP shapes
    <#DatasetShape>
      a sh:NodeShape ;
      sh:targetClass dcat:Dataset ;
      sh:property [
        sh:path dct:title ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
        sh:message "Dataset must have at least one title"@en ;
      ] ;
      sh:property [
        sh:path dct:description ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
        sh:message "Dataset must have at least one description"@en ;
      ] .
  `;
  
  return parseRDF(minimalShapes, 'turtle');
}

/**
 * Fix regex patterns in SHACL shapes to be JavaScript-compatible
 */
function fixRegexPatterns(shapesStore: Store): Store {
  const sh = 'http://www.w3.org/ns/shacl#';
  const patternPredicate = rdf.namedNode(sh + 'pattern');
  const fixedStore = new Store();
  
  for (const quad of shapesStore) {
    if (quad.predicate.equals(patternPredicate) && quad.object.termType === 'Literal') {
      const pattern = quad.object.value;
      
      // Convert SPARQL/XPath regex syntax to JavaScript
      // Remove inline flags like (?s), (?i), (?m), (?x) that JS doesn't support
      // These can appear anywhere in the pattern, e.g., ^(?s)pattern or (?i)pattern
      let fixedPattern = pattern.replace(/\(\?[imsx]+\)/g, '');
      
      // If pattern was modified, create a new quad with fixed pattern
      if (fixedPattern !== pattern) {
        console.log(`Fixed regex pattern: "${pattern}" -> "${fixedPattern}"`);
        const fixedQuad = rdf.quad(
          quad.subject,
          quad.predicate,
          rdf.literal(fixedPattern),
          quad.graph
        );
        fixedStore.addQuad(fixedQuad);
      } else {
        fixedStore.addQuad(quad);
      }
    } else {
      fixedStore.addQuad(quad);
    }
  }
  
  return fixedStore;
}

/**
 * Validate RDF data against SHACL shapes using shacl-engine
 */
export async function validateSHACL(
  dataStore: Store,
  profile: ValidationProfile
): Promise<SHACLReport> {
  try {
    let shapesStore = await loadSHACLShapes(profile);
    
    // Fix incompatible regex patterns in shapes
    shapesStore = fixRegexPatterns(shapesStore);
    
    console.log(`Running SHACL validation with ${shapesStore.size} shape triples against ${dataStore.size} data triples`);
    
    // Create SHACL validator with shacl-engine (supports SPARQL constraints)
    // Use rdf-ext factory which provides full RDF/JS compatibility including dataset() method
    const validator = new Validator(shapesStore, {
      factory: rdf,
      validations: sparqlValidations, // Enable SPARQL constraint support
    });
    
    // Run validation
    const report = await validator.validate({ dataset: dataStore });
    
    // Parse results from shacl-engine format
    const results: SHACLResult[] = [];
    
    // shacl-engine returns a dataset with validation report triples
    // We need to query it to extract the results
    const sh = 'http://www.w3.org/ns/shacl#';
    
    // Get all validation results
    const resultNodes = [...report.dataset.match(null, rdf.namedNode(sh + 'result'), null)]
      .map(quad => quad.object);
    
    for (const resultNode of resultNodes) {
      // Extract severity
      let severity: SHACLSeverity = 'Violation';
      const severityQuads = [...report.dataset.match(resultNode, rdf.namedNode(sh + 'resultSeverity'), null)];
      if (severityQuads.length > 0) {
        const severityStr = severityQuads[0].object.value;
        if (severityStr.includes('Warning')) {
          severity = 'Warning';
        } else if (severityStr.includes('Info')) {
          severity = 'Info';
        }
      }
      
      // Extract focus node
      const focusNodeQuads = [...report.dataset.match(resultNode, rdf.namedNode(sh + 'focusNode'), null)];
      const focusNode = focusNodeQuads.length > 0 ? focusNodeQuads[0].object.value : 'unknown';
      
      // Extract path
      const pathQuads = [...report.dataset.match(resultNode, rdf.namedNode(sh + 'resultPath'), null)];
      const path = pathQuads.length > 0 ? pathQuads[0].object.value : 'unknown';
      
      // Extract message
      const messageQuads = [...report.dataset.match(resultNode, rdf.namedNode(sh + 'resultMessage'), null)];
      const message = messageQuads.length > 0 ? messageQuads[0].object.value : 'SHACL validation failed';
      
      // Extract value (if any)
      const valueQuads = [...report.dataset.match(resultNode, rdf.namedNode(sh + 'value'), null)];
      const value = valueQuads.length > 0 ? valueQuads[0].object.value : undefined;
      
      // Extract source constraint component (optional)
      const componentQuads = [...report.dataset.match(resultNode, rdf.namedNode(sh + 'sourceConstraintComponent'), null)];
      const sourceConstraintComponent = componentQuads.length > 0 ? componentQuads[0].object.value : undefined;
      
      results.push({
        severity,
        focusNode,
        path,
        message,
        value,
        sourceConstraintComponent,
      });
    }
    
    console.log(`SHACL validation complete: ${report.conforms ? 'VALID' : 'INVALID'} (${results.length} issues found)`);
    
    return {
      conforms: report.conforms,
      results,
      profile,
    };
  } catch (error) {
    console.error('SHACL validation error:', error);
    return {
      conforms: false,
      results: [{
        severity: 'Violation',
        focusNode: 'unknown',
        path: 'unknown',
        message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      profile,
    };
  }
}

/**
 * Parse severity from SHACL result
 */
export function parseSeverity(severityUri: string): SHACLSeverity {
  if (severityUri.includes('Violation')) return 'Violation';
  if (severityUri.includes('Warning')) return 'Warning';
  return 'Info';
}

/**
 * Group SHACL results by severity
 */
export function groupBySeverity(results: SHACLResult[]): Record<SHACLSeverity, SHACLResult[]> {
  return results.reduce((acc, result) => {
    const severity = result.severity;
    if (!acc[severity]) {
      acc[severity] = [];
    }
    acc[severity].push(result);
    return acc;
  }, {} as Record<SHACLSeverity, SHACLResult[]>);
}

/**
 * Group SHACL results by path and message to aggregate similar violations
 */
export function groupSimilarResults(results: SHACLResult[], maxExamples: number = 3): GroupedSHACLResult[] {
  const groups = new Map<string, GroupedSHACLResult>();
  
  results.forEach(result => {
    // Create a key based on path + message to group similar violations
    const key = `${result.path || 'unknown'}::${result.message}`;
    
    if (!groups.has(key)) {
      groups.set(key, {
        severity: result.severity,
        path: result.path || 'unknown',
        message: result.message,
        count: 0,
        focusNodes: [],
        examples: [],
      });
    }
    
    const group = groups.get(key)!;
    group.count++;
    group.focusNodes.push(result.focusNode);
    
    // Only keep first few examples to avoid memory issues
    if (group.examples.length < maxExamples) {
      group.examples.push(result);
    }
  });
  
  // Convert to array and sort by count (most frequent first)
  return Array.from(groups.values())
    .sort((a, b) => b.count - a.count);
}

/**
 * Filter SHACL results by severity
 */
export function filterBySeverity(results: SHACLResult[], severity?: SHACLSeverity): SHACLResult[] {
  if (!severity) return results;
  return results.filter(r => r.severity === severity);
}

/**
 * Export SHACL report as Turtle (RDF format) with enhanced metadata
 */
export async function exportSHACLReportAsTurtle(report: SHACLReport, profileVersion?: string): Promise<string> {
  const timestamp = new Date().toISOString();
  
  // Load config to get app info and profile details
  const configResponse = await fetch('/mqa-config.json');
  const mqaConfig = await configResponse.json();
  
  const appInfo = mqaConfig.app_info;
  const appName = appInfo?.name || 'Metadata Quality Assessment Tool';
  const appVersion = appInfo?.version || '1.0.0';
  const appRepository = appInfo?.repository || 'https://github.com/mjanez/metadata-quality-app';
  const appUrl = appInfo?.url || window.location.origin;
  const appDescription = appInfo?.description || 'A tool for assessing metadata quality using SHACL validation.';
  
  // Get profile configuration
  const profileId = report.profile;
  const profileConfig = profileId ? mqaConfig.profiles?.[profileId] : undefined;
  
  // Determine version
  let version = profileVersion || profileConfig?.defaultVersion;
  
  // Get version-specific configuration
  let profileName = String(profileId);
  let profileUrl = '';
  
  if (profileConfig && version && profileConfig.versions?.[version]) {
    const versionConfig = profileConfig.versions[version];
    profileName = versionConfig.name || profileConfig.name || String(profileId);
    profileUrl = versionConfig.url || '';
  }
  
  const prefixes = `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix dcat: <http://www.w3.org/ns/dcat#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix doap: <http://usefulinc.com/ns/doap#> .

`;

  let turtle = prefixes;
  
  // Validation Report with enhanced metadata
  turtle += `# Validation Report\n`;
  turtle += `[ a sh:ValidationReport ;\n`;
  turtle += `    sh:conforms ${report.conforms} ;\n`;
  
  // Add metadata annotations
  turtle += `    dct:created "${timestamp}"^^xsd:dateTime ;\n`;
  turtle += `    dct:creator [ a foaf:Agent ;\n`;
  turtle += `            foaf:name "${appName}" ;\n`;
  turtle += `            doap:release [ a doap:Version ;\n`;
  turtle += `                    doap:revision "${appVersion}" ;\n`;
  turtle += `                    doap:created "${timestamp}"^^xsd:dateTime\n`;
  turtle += `                ] ;\n`;
  turtle += `            foaf:homepage <${appUrl}> ;\n`;
  turtle += `            foaf:page <${appRepository}> ;\n`;
  turtle += `            rdfs:comment "${appDescription}"\n`;
  turtle += `        ] ;\n`;
  turtle += `    dct:title "Informe de Validación SHACL para el perfil ${profileName} generado por ${appName} v${appVersion}"@es ;\n`;
  turtle += `    dct:title "SHACL Validation Report for profile ${profileName} generated by ${appName} v${appVersion}"@en ;\n`;
  turtle += `    dct:format <http://publications.europa.eu/resource/authority/file-type/RDF_TURTLE> ;\n`;
  turtle += `    dct:description "Este archivo contiene el informe de validación SHACL para el perfil ${profileName}. Se han detectado ${report.results.length} resultados. Estado de conformidad: ${report.conforms ? 'Conforme' : 'No conforme'}."@es ;\n`;
  turtle += `    dct:description "This file contains the SHACL validation report for profile ${profileName}. A total of ${report.results.length} results were found. Conformance status: ${report.conforms ? 'Conforms' : 'Non-conforms'}."@en`;
  
  if (profileUrl) {
    turtle += ` ;\n    rdfs:seeAlso <${profileUrl}>`;
  }
  
  // Add validation results
  if (report.results.length > 0) {
    turtle += ` ;\n    sh:result`;
    
    report.results.forEach((result, index) => {
      const isLast = index === report.results.length - 1;
      
      turtle += `\n        [ a sh:ValidationResult ;\n`;
      
      // Severity
      const severityMap: Record<SHACLSeverity, string> = {
        'Violation': 'sh:Violation',
        'Warning': 'sh:Warning',
        'Info': 'sh:Info'
      };
      turtle += `            sh:resultSeverity ${severityMap[result.severity]} ;\n`;
      
      // Focus node
      if (result.focusNode) {
        turtle += `            sh:focusNode <${result.focusNode}> ;\n`;
      }
      
      // Path
      if (result.path && result.path !== 'unknown') {
        turtle += `            sh:resultPath <${result.path}> ;\n`;
      }
      
      // Messages with language detection
      if (Array.isArray(result.message)) {
        result.message.forEach(msg => {
          const langMatch = msg.match(/@([a-z]{2})$/);
          const cleanMsg = msg.replace(/^"(.*)"(@[a-z]{2})?$/g, '$1').replace(/"/g, '\\"');
          
          if (langMatch) {
            turtle += `            sh:resultMessage "${cleanMsg}"@${langMatch[1]} ;\n`;
          } else {
            turtle += `            sh:resultMessage "${cleanMsg}" ;\n`;
          }
        });
      } else if (result.message) {
        const msg = String(result.message);
        const langMatch = msg.match(/@([a-z]{2})$/);
        const cleanMsg = msg.replace(/^"(.*)"(@[a-z]{2})?$/g, '$1').replace(/"/g, '\\"');
        
        if (langMatch) {
          turtle += `            sh:resultMessage "${cleanMsg}"@${langMatch[1]} ;\n`;
        } else {
          turtle += `            sh:resultMessage "${cleanMsg}" ;\n`;
        }
      }
      
      // Value (if present)
      if (result.value) {
        if (result.value.startsWith('http://') || result.value.startsWith('https://')) {
          turtle += `            sh:value <${result.value}> ;\n`;
        } else {
          const escapedValue = result.value.replace(/"/g, '\\"');
          turtle += `            sh:value "${escapedValue}" ;\n`;
        }
      }
      
      // Source constraint component
      if (result.sourceConstraintComponent) {
        const component = result.sourceConstraintComponent.startsWith('sh:') 
          ? result.sourceConstraintComponent 
          : result.sourceConstraintComponent.startsWith('http://') 
          ? `<${result.sourceConstraintComponent}>`
          : `sh:${result.sourceConstraintComponent}`;
        turtle += `            sh:sourceConstraintComponent ${component} ;\n`;
      }
      
      // Source shape
      if (result.sourceShape) {
        const shape = result.sourceShape.startsWith('_:') 
          ? result.sourceShape 
          : result.sourceShape.startsWith('http://') 
          ? `<${result.sourceShape}>`
          : `<${result.sourceShape}>`;
        turtle += `            sh:sourceShape ${shape} ;\n`;
      }
      
      // Remove trailing semicolon
      turtle = turtle.replace(/;\s*$/, '');
      turtle += `\n        ]`;
      
      if (!isLast) {
        turtle += ' ,';
      }
    });
  }
  
  turtle += `\n] .\n\n`;
  
  // Profile Information
  turtle += `# Profile Information\n`;
  turtle += `[ a dct:Standard ;\n`;
  turtle += `    dct:title "${profileName}"@es ;\n`;
  turtle += `    dct:title "${profileName}"@en ;\n`;
  turtle += `    dct:identifier "${profileId}-${version}" ;\n`;
  
  if (version) {
    turtle += `    dct:hasVersion "${version}" ;\n`;
  }
  
  if (profileUrl) {
    turtle += `    foaf:page <${profileUrl}> ;\n`;
  }
  
  turtle += `    rdfs:comment "Perfil utilizado para la validación SHACL"@es ;\n`;
  turtle += `    rdfs:comment "Profile used for SHACL validation"@en\n`;
  turtle += `] .\n`;
  
  return turtle;
}

/**
 * Export SHACL report as CSV
 */
export function exportSHACLReportAsCSV(results: SHACLResult[]): string {
  // CSV header
  let csv = 'Severity,Focus Node,Property Path,Message,Value,Constraint Component\n';
  
  // CSV rows
  results.forEach(result => {
    const row = [
      result.severity,
      escapeCSV(result.focusNode),
      escapeCSV(result.path || 'unknown'),
      escapeCSV(result.message),
      escapeCSV(result.value || ''),
      escapeCSV(result.sourceConstraintComponent || '')
    ];
    csv += row.join(',') + '\n';
  });
  
  return csv;
}

/**
 * Escape CSV field value
 */
function escapeCSV(value: string): string {
  if (!value) return '';
  // If value contains comma, newline, or quote, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Download file helper
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
