export function getApiUrl(path: string): string {
  const base = typeof window !== 'undefined' && window.location.hostname.includes('pages.dev')
    ? 'https://agente-financiero.danelgomez-mgvc.workers.dev'
    : '';
  return `${base}${path}`;
}
