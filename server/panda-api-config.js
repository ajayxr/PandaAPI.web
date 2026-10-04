export const DEFAULT_PANDAAPI_BASE_URL = 'https://api.pandaapi.com.br'

export function resolvePandaApiBaseUrl(value = '') {
  const configuredUrl = value.trim() || DEFAULT_PANDAAPI_BASE_URL
  let apiUrl

  try {
    apiUrl = new URL(configuredUrl)
  } catch {
    throw new Error('PANDAAPI_BASE_URL inválida. Informe a URL HTTPS da API PandaAPI.')
  }

  if (apiUrl.protocol !== 'https:' || apiUrl.username || apiUrl.password || apiUrl.pathname !== '/' || apiUrl.search || apiUrl.hash) {
    throw new Error('PANDAAPI_BASE_URL inválida. Informe somente a origem HTTPS da API PandaAPI.')
  }

  return apiUrl.origin
}
