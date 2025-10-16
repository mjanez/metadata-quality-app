'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn, truncate } from '@/app/lib/utils';
import type { GroupedSHACLResult, SHACLSeverity } from '@/app/types';
import { AlertCircle, AlertTriangle, Info, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

interface SHACLTableProps {
  results: GroupedSHACLResult[];
}

/**
 * Render text with clickable URLs
 */
function renderTextWithLinks(text: string) {
  // Regex to match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
        >
          {part}
          <ExternalLink size={12} className="flex-shrink-0" />
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function SHACLTable({ results }: SHACLTableProps) {
  const t = useTranslations();
  const [filterSeverity, setFilterSeverity] = useState<SHACLSeverity | 'all'>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  const filteredResults =
    filterSeverity === 'all'
      ? results
      : results.filter((r) => r.severity === filterSeverity);

  const toggleGroup = (index: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedGroups(newExpanded);
  };

  const getSeverityIcon = (severity: SHACLSeverity) => {
    switch (severity) {
      case 'Violation':
        return <AlertCircle className="text-error" size={18} />;
      case 'Warning':
        return <AlertTriangle className="text-warning" size={18} />;
      case 'Info':
        return <Info className="text-info" size={18} />;
    }
  };

  const getSeverityBadge = (severity: SHACLSeverity) => {
    const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
    
    switch (severity) {
      case 'Violation':
        return (
          <span className={cn(baseClasses, 'bg-error-light text-error-dark')}>
            {t('shacl.violation')}
          </span>
        );
      case 'Warning':
        return (
          <span className={cn(baseClasses, 'bg-warning-light text-warning-dark')}>
            {t('shacl.warning')}
          </span>
        );
      case 'Info':
        return (
          <span className={cn(baseClasses, 'bg-info-light text-info-dark')}>
            {t('shacl.info')}
          </span>
        );
    }
  };

  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 dark:text-gray-400">
        <Info className="mx-auto mb-2" size={32} />
        <p>{t('shacl.noViolations')}</p>
      </div>
    );
  }

  // Calculate total individual violations
  const totalViolations = results.reduce((sum, group) => sum + group.count, 0);

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterSeverity('all')}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md transition-colors',
            filterSeverity === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          )}
        >
          {t('shacl.all')} ({results.reduce((sum, r) => sum + (filterSeverity === 'all' || r.severity === filterSeverity ? r.count : 0), 0)})
        </button>
        <button
          onClick={() => setFilterSeverity('Violation')}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md transition-colors',
            filterSeverity === 'Violation'
              ? 'bg-error text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          )}
        >
          {t('shacl.violation')} ({results.filter((r) => r.severity === 'Violation').reduce((sum, r) => sum + r.count, 0)})
        </button>
        <button
          onClick={() => setFilterSeverity('Warning')}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md transition-colors',
            filterSeverity === 'Warning'
              ? 'bg-warning text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          )}
        >
          {t('shacl.warning')} ({results.filter((r) => r.severity === 'Warning').reduce((sum, r) => sum + r.count, 0)})
        </button>
        <button
          onClick={() => setFilterSeverity('Info')}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md transition-colors',
            filterSeverity === 'Info'
              ? 'bg-info text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          )}
        >
          {t('shacl.info')} ({results.filter((r) => r.severity === 'Info').reduce((sum, r) => sum + r.count, 0)})
        </button>
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {t('shacl.grouped')} {filteredResults.length} {t('shacl.types')} ({totalViolations} {t('shacl.total')})
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {filteredResults.map((group, index) => {
          const isExpanded = expandedGroups.has(index);
          
          return (
            <div
              key={index}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
            >
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(index)}
                className="w-full p-4 flex items-start gap-3 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getSeverityIcon(group.severity)}
                </div>
                <div className="flex-1 min-w-0 text-left space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {renderTextWithLinks(group.message)}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {group.count}× {t('shacl.occurrences')}
                      </span>
                      {getSeverityBadge(group.severity)}
                    </div>
                  </div>
                  
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('shacl.path')}:
                    </span>
                    <span className="ml-2 font-mono text-xs text-gray-900 dark:text-white">
                      {truncate(group.path, 60)}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0 mt-1">
                  {isExpanded ? (
                    <ChevronDown className="text-gray-500" size={20} />
                  ) : (
                    <ChevronRight className="text-gray-500" size={20} />
                  )}
                </div>
              </button>

              {/* Expanded Examples */}
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-850 space-y-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('shacl.examples')} ({Math.min(group.examples.length, 3)} {t('shacl.of')} {group.count}):
                  </p>
                  {group.examples.slice(0, 3).map((example, exIdx) => (
                    <div
                      key={exIdx}
                      className="p-3 rounded bg-gray-50 dark:bg-gray-800 space-y-2"
                    >
                      <div className="text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          {t('shacl.focusNode')}:
                        </span>
                        <span className="ml-2 font-mono text-xs text-gray-900 dark:text-white break-all">
                          {truncate(example.focusNode, 80)}
                        </span>
                      </div>
                      {example.value && (
                        <div className="text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            {t('shacl.value')}:
                          </span>
                          <span className="ml-2 font-mono text-xs text-gray-900 dark:text-white break-all">
                            {truncate(example.value, 80)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {group.count > 3 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                      {t('shacl.andMore', { count: group.count - 3 })}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredResults.length === 0 && filterSeverity !== 'all' && (
        <div className="text-center py-8 text-gray-600 dark:text-gray-400">
          <p>{t('shacl.noResults', { severity: t(`shacl.${filterSeverity.toLowerCase()}`) })}</p>
        </div>
      )}
    </div>
  );
}
