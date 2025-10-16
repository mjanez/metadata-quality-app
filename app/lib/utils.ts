import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases condicionales y resuelve conflictos de Tailwind
 * Uso: cn('text-red-500', condition && 'bg-blue-500', 'p-4')
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un número como porcentaje
 */
export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * Formatea un timestamp a fecha legible
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Trunca un string largo
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

/**
 * Extrae el nombre local de una URI
 */
export function getLocalName(uri: string): string {
  const match = uri.match(/[#\/]([^#\/]+)$/);
  return match ? match[1] : uri;
}

/**
 * Normaliza URIs para comparación
 */
export function normalizeUri(uri: string): string {
  return uri.trim().replace(/\/$/, '');
}
