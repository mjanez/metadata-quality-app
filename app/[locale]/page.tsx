'use client';

import { useTranslations } from 'next-intl';
import { ValidationForm } from '@/app/components/ValidationForm';
import { ValidationResults } from '@/app/components/ValidationResults';
import { LanguageToggle } from '@/app/components/LanguageToggle';
import { ThemeToggle } from '@/app/components/ThemeToggle';
import { useValidation } from '@/app/hooks/useValidation';
import { Github } from 'lucide-react';

export default function HomePage() {
  const t = useTranslations();
  const validationState = useValidation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 
                         bg-white dark:bg-gray-900 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('app.title')}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {t('app.subtitle')}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <a
                href="https://github.com/mjanez/metadata-quality-app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 rounded-lg
                           bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
                           text-gray-700 dark:text-gray-300 transition-colors"
                aria-label="GitHub"
              >
                <Github size={18} />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Validation Form */}
          <div className="lg:sticky lg:top-24">
            <ValidationForm validationState={validationState} />
          </div>

          {/* Right Column: Results */}
          <div>
            <ValidationResults validationState={validationState} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-200 dark:border-gray-800 
                         bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p>
              Built with{' '}
              <a
                href="https://nextjs.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700 dark:text-primary-400 
                           dark:hover:text-primary-300 font-medium"
              >
                Next.js 15
              </a>
              {' + '}
              <a
                href="https://tailwindcss.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700 dark:text-primary-400 
                           dark:hover:text-primary-300 font-medium"
              >
                Tailwind CSS 4
              </a>
            </p>
            <p className="mt-2 text-xs">
              RDF Parsing: <a href="https://github.com/rdfjs/N3.js" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium">n3.js</a> • Validation: <a href="https://github.com/rdf-ext/shacl-engine" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium">shacl-engine</a> • Charts: <a href="https://github.com/chartjs/Chart.js" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium">Chart.js</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
