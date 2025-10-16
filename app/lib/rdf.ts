import { Parser, Writer, Store, DataFactory } from 'n3';
import { RdfXmlParser } from 'rdfxml-streaming-parser';
import type { RDFFormat } from '@/app/types';

const { namedNode, literal, quad } = DataFactory;

/**
 * Detect RDF format from content
 */
export function detectFormat(content: string): RDFFormat {
  const trimmed = content.trim();
  
  // RDF/XML detection
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<rdf:RDF')) {
    return 'rdfxml';
  }
  
  // JSON-LD detection
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'jsonld';
    } catch {
      // Not valid JSON
    }
  }
  
  // N-Triples detection (simple: ends with .)
  if (trimmed.includes('>\n<') && !trimmed.includes('@prefix')) {
    return 'ntriples';
  }
  
  // N-Quads detection
  if (trimmed.includes('>\n<') && trimmed.includes('>  <')) {
    return 'nquads';
  }
  
  // Default to Turtle
  return 'turtle';
}

/**
 * Get N3 format string
 */
function getN3Format(format: RDFFormat): string {
  const formatMap: Record<RDFFormat, string> = {
    turtle: 'text/turtle',
    ntriples: 'application/n-triples',
    nquads: 'application/n-quads',
    jsonld: 'application/ld+json',
    rdfxml: 'application/rdf+xml',
  };
  return formatMap[format];
}

/**
 * Parse RDF content to N3 Store
 */
export async function parseRDF(content: string, format?: RDFFormat): Promise<Store> {
  const detectedFormat = format || detectFormat(content);
  
  if (detectedFormat === 'rdfxml') {
    return parseRDFXML(content);
  }
  
  if (detectedFormat === 'jsonld') {
    return parseJSONLD(content);
  }
  
  // Use N3 parser for Turtle, N-Triples, N-Quads
  return parseWithN3(content, detectedFormat);
}

/**
 * Parse with N3 library (Turtle, N-Triples, N-Quads)
 */
async function parseWithN3(content: string, format: RDFFormat): Promise<Store> {
  return new Promise((resolve, reject) => {
    const parser = new Parser({ format: getN3Format(format) });
    const store = new Store();
    
    try {
      const quads = parser.parse(content);
      store.addQuads(quads);
      resolve(store);
    } catch (error) {
      reject(new Error(`N3 parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}

/**
 * Parse RDF/XML using streaming parser with lenient IRI validation
 */
async function parseRDFXML(content: string): Promise<Store> {
  return new Promise((resolve, reject) => {
    // Pre-sanitize content to fix common IRI issues
    const sanitizedContent = sanitizeRDFXMLContent(content);
    
    const parser = new RdfXmlParser({ 
      baseIRI: 'http://example.org/',
      // Pre-processing handles invalid IRIs
    });
    const store = new Store();
    const errors: string[] = [];
    let quadCount = 0;
    let hasEnded = false;
    
    parser.on('data', (quad) => {
      try {
        // Try to add the quad, but sanitize IRIs if needed
        const sanitizedQuad = sanitizeQuad(quad);
        store.addQuad(sanitizedQuad);
        quadCount++;
      } catch (error) {
        // Log error but continue parsing
        errors.push(`Skipped quad: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
    
    parser.on('error', (error) => {
      // Don't reject on individual errors, collect them
      errors.push(error.message);
      // If we haven't parsed any quads and got an error, reject
      if (quadCount === 0 && !hasEnded) {
        reject(new Error(`RDF/XML parsing failed: ${error.message}`));
      }
    });
    
    parser.on('end', () => {
      hasEnded = true;
      if (errors.length > 0) {
        console.warn(`RDF/XML parsing completed with ${errors.length} warnings (${quadCount} quads parsed):`, errors.slice(0, 5));
      }
      if (quadCount === 0) {
        reject(new Error('RDF/XML parsing produced no triples. The content may be invalid or empty.'));
      } else {
        resolve(store);
      }
    });
    
    try {
      // Write content in smaller chunks to handle large files
      const chunkSize = 50000;
      for (let i = 0; i < sanitizedContent.length; i += chunkSize) {
        const chunk = sanitizedContent.slice(i, i + chunkSize);
        parser.write(chunk);
      }
      parser.end();
    } catch (error) {
      reject(new Error(`RDF/XML parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}

/**
 * Pre-sanitize RDF/XML content to fix common IRI issues
 */
function sanitizeRDFXMLContent(content: string): string {
  // Fix IRIs with spaces and other invalid characters in rdf:about and rdf:resource attributes
  return content
    .replace(/rdf:about="([^"]*\s[^"]*)"/g, (match, iri) => {
      const sanitized = encodeIRIChars(iri);
      return `rdf:about="${sanitized}"`;
    })
    .replace(/rdf:resource="([^"]*\s[^"]*)"/g, (match, iri) => {
      const sanitized = encodeIRIChars(iri);
      return `rdf:resource="${sanitized}"`;
    })
    .replace(/rdf:ID="([^"]*\s[^"]*)"/g, (match, iri) => {
      const sanitized = encodeIRIChars(iri);
      return `rdf:ID="${sanitized}"`;
    });
}

/**
 * Encode invalid characters in IRIs
 */
function encodeIRIChars(iri: string): string {
  return iri
    .replace(/ /g, '%20')
    .replace(/\|/g, '%7C')
    .replace(/\\/g, '%5C')
    .replace(/\^/g, '%5E')
    .replace(/`/g, '%60')
    .replace(/\{/g, '%7B')
    .replace(/\}/g, '%7D')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E');
}

/**
 * Sanitize a quad by encoding invalid characters in IRIs
 */
function sanitizeQuad(quad: any): any {
  const sanitizeIRI = (term: any) => {
    if (term.termType === 'NamedNode') {
      // Encode spaces and other invalid characters in IRIs
      const sanitized = term.value
        .replace(/ /g, '%20')
        .replace(/\|/g, '%7C')
        .replace(/\\/g, '%5C')
        .replace(/\^/g, '%5E')
        .replace(/`/g, '%60')
        .replace(/\{/g, '%7B')
        .replace(/\}/g, '%7D');
      
      if (sanitized !== term.value) {
        return namedNode(sanitized);
      }
    }
    return term;
  };

  return quad(
    sanitizeIRI(quad.subject),
    sanitizeIRI(quad.predicate),
    sanitizeIRI(quad.object),
    quad.graph
  );
}

/**
 * Parse JSON-LD (simplified - requires @context processing in production)
 */
async function parseJSONLD(content: string): Promise<Store> {
  try {
    const jsonld = JSON.parse(content);
    const store = new Store();
    
    // Simple JSON-LD to triples conversion (basic implementation)
    // In production, use jsonld.js library for full JSON-LD support
    if (Array.isArray(jsonld)) {
      jsonld.forEach(item => processJSONLDItem(item, store));
    } else {
      processJSONLDItem(jsonld, store);
    }
    
    return store;
  } catch (error) {
    throw new Error(`JSON-LD parsing error: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
  }
}

/**
 * Process a single JSON-LD item (basic implementation)
 */
function processJSONLDItem(item: any, store: Store) {
  if (!item['@id']) return;
  
  const subject = namedNode(item['@id']);
  
  Object.entries(item).forEach(([key, value]) => {
    if (key.startsWith('@')) return; // Skip JSON-LD keywords
    
    const predicate = namedNode(key);
    
    if (typeof value === 'string') {
      store.addQuad(quad(subject, predicate, literal(value)));
    } else if (value && typeof value === 'object' && '@id' in value) {
      const objValue = value as { '@id': string };
      store.addQuad(quad(subject, predicate, namedNode(objValue['@id'])));
    }
  });
}

/**
 * Serialize Store to Turtle
 */
export async function serializeToTurtle(store: Store, prefixes?: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const defaultPrefixes = {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      dcat: 'http://www.w3.org/ns/dcat#',
      dct: 'http://purl.org/dc/terms/',
      foaf: 'http://xmlns.com/foaf/0.1/',
      vcard: 'http://www.w3.org/2006/vcard/ns#',
      ...prefixes,
    };
    
    const writer = new Writer({ prefixes: defaultPrefixes });
    writer.addQuads(store.getQuads(null, null, null, null));
    
    writer.end((error: Error | null, result: string) => {
      if (error) {
        reject(new Error(`Serialization error: ${error.message}`));
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Get all subjects of a specific type
 */
export function getSubjectsByType(store: Store, typeUri: string): string[] {
  const rdfType = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
  const type = namedNode(typeUri);
  
  const subjects = store.getSubjects(rdfType, type, null);
  return subjects.map((s: { value: string }) => s.value);
}

/**
 * Get object values for a subject and predicate
 */
export function getObjects(store: Store, subjectUri: string, predicateUri: string): string[] {
  const subject = namedNode(subjectUri);
  const predicate = namedNode(predicateUri);
  
  const objects = store.getObjects(subject, predicate, null);
  return objects.map((o: { value: string }) => o.value);
}

/**
 * Check if a triple exists
 */
export function hasTriple(store: Store, subjectUri: string, predicateUri: string, objectUri?: string): boolean {
  const subject = namedNode(subjectUri);
  const predicate = namedNode(predicateUri);
  const object = objectUri ? namedNode(objectUri) : null;
  
  return store.getQuads(subject, predicate, object, null).length > 0;
}

/**
 * Count triples in store
 */
export function countTriples(store: Store): number {
  return store.size;
}

/**
 * Get all unique predicates
 */
export function getPredicates(store: Store): string[] {
  const predicates = new Set<string>();
  store.forEach((quad: { predicate: { value: string } }) => {
    predicates.add(quad.predicate.value);
  });
  return Array.from(predicates);
}

/**
 * Get a single object value for a subject and predicate
 */
export function getObjectValue(store: Store, subjectUri: string, predicateUri: string): string | null {
  const objects = getObjects(store, subjectUri, predicateUri);
  return objects.length > 0 ? objects[0] : null;
}

/**
 * Common RDF namespaces
 */
export const NAMESPACES = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  dcat: 'http://www.w3.org/ns/dcat#',
  dct: 'http://purl.org/dc/terms/',
  foaf: 'http://xmlns.com/foaf/0.1/',
  vcard: 'http://www.w3.org/2006/vcard/ns#',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  adms: 'http://www.w3.org/ns/adms#',
  schema: 'http://schema.org/',
};
