import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import es from './locales/es.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            es: { translation: es },
        },
        fallbackLng: 'es',
        supportedLngs: ['en', 'es'],
        detection: {
            // Priority order for language detection
            order: ['localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage'],
            lookupLocalStorage: 'erp-language',
        },
        interpolation: {
            escapeValue: false, // React already escapes
        },
    });

export default i18n;

/** Supported language codes */
export type AppLanguage = 'en' | 'es';

export const SUPPORTED_LANGUAGES: { code: AppLanguage; label: string; flag: string }[] = [
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
];
