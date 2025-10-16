/**
 * Controlled vocabularies for MQA validation
 * Dynamically loaded from public/data/*.jsonl files (data.europa.eu vocabularies)
 */

interface VocabularyEntry {
  uri: string;
  label?: string;
}

let KNOWN_LICENSES: Set<string> | null = null;
let KNOWN_ACCESS_RIGHTS: Set<string> | null = null;
let MACHINE_READABLE_FORMATS: Set<string> | null = null;
let NON_PROPRIETARY_FORMATS: Set<string> | null = null;
let FILE_TYPES: Set<string> | null = null;
let MEDIA_TYPES: Set<string> | null = null;

/**
 * Load vocabulary from JSONL file
 */
async function loadVocabulary(filename: string): Promise<Set<string>> {
  try {
    const response = await fetch(`/data/${filename}`);
    if (!response.ok) {
      console.warn(`Failed to load vocabulary ${filename}: ${response.statusText}`);
      return new Set();
    }
    const text = await response.text();
    const lines = text.trim().split('\n');
    const uris = new Set<string>();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry: VocabularyEntry = JSON.parse(line);
        if (entry.uri) {
          uris.add(entry.uri);
        }
      } catch (e) {
        console.warn(`Error parsing line in ${filename}:`, line);
      }
    }
    return uris;
  } catch (error) {
    console.error(`Error loading vocabulary ${filename}:`, error);
    return new Set();
  }
}

/**
 * Load all vocabularies (call once at startup)
 */
async function loadAllVocabularies() {
  if (KNOWN_LICENSES) return; // Already loaded

  const [licenses, accessRights, machineReadable, nonProprietary, fileTypes, mediaTypes] = await Promise.all([
    loadVocabulary('licenses.jsonl'),
    loadVocabulary('access_rights.jsonl'),
    loadVocabulary('machine_readable.jsonl'),
    loadVocabulary('non_proprietary.jsonl'),
    loadVocabulary('file_types.jsonl'),
    loadVocabulary('media_types.jsonl'),
  ]);

  KNOWN_LICENSES = licenses;
  KNOWN_ACCESS_RIGHTS = accessRights;
  MACHINE_READABLE_FORMATS = machineReadable;
  NON_PROPRIETARY_FORMATS = nonProprietary;
  FILE_TYPES = fileTypes;
  MEDIA_TYPES = mediaTypes;
}

/**
 * Ensure vocabularies are loaded
 */
async function ensureVocabulariesLoaded() {
  if (!KNOWN_LICENSES) {
    await loadAllVocabularies();
  }
}

/**
 * Format labels mapping
 */
export const FORMAT_LABELS: Record<string, string> = {
  'RDF': 'application/rdf+xml',
  'TURTLE': 'text/turtle',
  'TTL': 'text/turtle',
  'JSONLD': 'application/ld+json',
  'JSON-LD': 'application/ld+json',
  'NT': 'application/n-triples',
  'NTRIPLES': 'application/n-triples',
  'JSON': 'application/json',
  'XML': 'application/xml',
  'CSV': 'text/csv',
  'PDF': 'application/pdf',
  'HTML': 'text/html',
  'XLSX': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'XLS': 'application/vnd.ms-excel',
};

/**
 * Check if a format is machine-readable
 */
export async function isMachineReadable(format: string): Promise<boolean> {
  await ensureVocabulariesLoaded();
  const normalized = normalizeFormat(format);
  return MACHINE_READABLE_FORMATS?.has(normalized) || false;
}

/**
 * Check if a format is non-proprietary
 */
export async function isNonProprietary(format: string): Promise<boolean> {
  await ensureVocabulariesLoaded();
  const normalized = normalizeFormat(format);
  return NON_PROPRIETARY_FORMATS?.has(normalized) || false;
}

/**
 * Check if a license is from a known vocabulary
 */
export async function isKnownLicense(license: string): Promise<boolean> {
  await ensureVocabulariesLoaded();
  return KNOWN_LICENSES?.has(license) || false;
}

/**
 * Check if access rights value is from known vocabulary
 */
export async function isKnownAccessRights(accessRights: string): Promise<boolean> {
  await ensureVocabulariesLoaded();
  return KNOWN_ACCESS_RIGHTS?.has(accessRights) || false;
}

/**
 * Normalize format string to media type
 */
export function normalizeFormat(format: string): string {
  // If already a media type
  if (format.includes('/')) {
    return format.toLowerCase();
  }
  
  // Try to map from label
  const upper = format.toUpperCase();
  return FORMAT_LABELS[upper] || format.toLowerCase();
}
