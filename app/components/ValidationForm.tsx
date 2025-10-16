'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/app/lib/utils';
import { Loader2, FileText, Link as LinkIcon, AlertCircle, ExternalLink } from 'lucide-react';
import type { ValidationProfile, ValidationInputType } from '@/app/types';
import Image from 'next/image';

interface ProfileVersion {
  name: string;
  version?: string;
  ico: string;
  url: string;
  maxScore: number;
}

interface ProfileConfig {
  versions: Record<string, ProfileVersion>;
  defaultVersion: string;
}

interface ValidationFormProps {
  validationState: {
    validate: (input: any, profile: ValidationProfile) => Promise<void>;
    isLoading: boolean;
    progress: string;
    error: string | null;
    clear: () => void;
  };
}

export function ValidationForm({ validationState }: ValidationFormProps) {
  const t = useTranslations();
  const { validate, isLoading, progress, error, clear } = validationState;
  
  const [inputType, setInputType] = useState<ValidationInputType>('text');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [profile, setProfile] = useState<ValidationProfile>('dcat_ap');
  const [profileVersion, setProfileVersion] = useState<string>('2.1.1');
  const [profilesConfig, setProfilesConfig] = useState<Record<string, ProfileConfig>>({});
  const [selectedProfileData, setSelectedProfileData] = useState<ProfileVersion | null>(null);

  // Load profiles configuration
  useEffect(() => {
    fetch('/mqa-config.json')
      .then(res => res.json())
      .then(data => {
        setProfilesConfig(data.profiles || {});
        // Set default version for current profile
        const defaultVer = data.profiles?.[profile]?.defaultVersion;
        if (defaultVer) {
          setProfileVersion(defaultVer);
        }
      })
      .catch(err => console.error('Error loading profiles config:', err));
  }, []);

  // Update profile data when profile or version changes
  useEffect(() => {
    if (profilesConfig[profile]?.versions?.[profileVersion]) {
      setSelectedProfileData(profilesConfig[profile].versions[profileVersion]);
    }
  }, [profile, profileVersion, profilesConfig]);

  // Update version when profile changes
  const handleProfileChange = (newProfile: ValidationProfile) => {
    setProfile(newProfile);
    const defaultVer = profilesConfig[newProfile]?.defaultVersion || Object.keys(profilesConfig[newProfile]?.versions || {})[0];
    if (defaultVer) {
      setProfileVersion(defaultVer);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await validate({
      type: inputType,
      content: inputType === 'text' ? content : '',
      url: inputType === 'url' ? url : '',
    }, profile);
  };

  return (
    <div className="card">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('validation.title')}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('app.description')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Selector */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('validation.profile')}
            </label>
            <select
              value={profile}
              onChange={(e) => handleProfileChange(e.target.value as ValidationProfile)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         transition-colors"
              disabled={isLoading}
            >
              {Object.entries(profilesConfig).map(([key, config]) => {
                const firstVersion = Object.values(config.versions)[0];
                return (
                  <option key={key} value={key}>
                    {firstVersion?.name.split(' ')[0] || key}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Version Selector */}
          {profilesConfig[profile]?.versions && Object.keys(profilesConfig[profile].versions).length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Version
              </label>
              <select
                value={profileVersion}
                onChange={(e) => setProfileVersion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent
                           transition-colors"
                disabled={isLoading}
              >
                {Object.entries(profilesConfig[profile]?.versions || {}).map(([version, versionData]) => (
                  <option key={version} value={version}>
                    {versionData.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Profile Info Card */}
          {selectedProfileData && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              {selectedProfileData.ico && (
                <Image
                  src={`/${selectedProfileData.ico}`}
                  alt={t('ui.profileIconAlt')}
                  width={32}
                  height={32}
                  className="flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedProfileData.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('ui.maxScore', { score: selectedProfileData.maxScore })}
                </p>
              </div>
              {selectedProfileData.url && (
                <a
                  href={selectedProfileData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                  title={t('ui.viewProfileDocumentation')}
                >
                  <ExternalLink size={18} />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Input Type Tabs */}
        <div>
          <div className="flex space-x-1 border-b border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setInputType('text')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 font-medium text-sm transition-all',
                inputType === 'text'
                  ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              )}
              disabled={isLoading}
            >
              <FileText size={16} />
              {t('validation.inputType.text')}
            </button>
            <button
              type="button"
              onClick={() => setInputType('url')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 font-medium text-sm transition-all',
                inputType === 'url'
                  ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              )}
              disabled={isLoading}
            >
              <LinkIcon size={16} />
              {t('validation.inputType.url')}
            </button>
          </div>
        </div>

        {/* Text Input */}
        {inputType === 'text' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('validation.rdfContent')}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('validation.rdfPlaceholder')}
              rows={14}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                         font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         scrollbar-thin resize-none"
              required
              disabled={isLoading}
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {t('validation.formatsSupported')}
            </p>
          </div>
        )}

        {/* URL Input */}
        {inputType === 'url' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('validation.rdfUrl')}
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('validation.urlPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         transition-colors"
              required
              disabled={isLoading}
            />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="font-medium text-red-900 dark:text-red-200">
                {t('validation.error')}
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {error}
              </p>
              <button
                type="button"
                onClick={clear}
                className="text-sm text-red-600 dark:text-red-400 hover:underline mt-2"
              >
                {t('validation.clear')}
              </button>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full flex items-center justify-center gap-2 h-11"
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>{progress || t('validation.validating')}</span>
            </>
          ) : (
            <span>{t('validation.validate')}</span>
          )}
        </button>
      </form>
    </div>
  );
}
