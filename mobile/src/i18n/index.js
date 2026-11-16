import en from './en';

const languages = { en };
let current = 'en';

export function setLanguage(code) {
  if (languages[code]) current = code;
}

// t('home.greeting', { name: 'Ravi' }) -> 'Hello, Ravi'
// Missing key in the current language falls back to English, then to the key itself.
export function t(key, params) {
  const text = languages[current][key] ?? en[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] === undefined || params[name] === null ? match : String(params[name])
  );
}

// Text for an API error code, with a generic fallback for codes we do not know.
export function errorText(code) {
  const key = `error.${code}`;
  return en[key] ? t(key) : t('error.INTERNAL');
}
