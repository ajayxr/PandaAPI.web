const TOKEN_CACHE_FALLBACK_MS = 5 * 60_000
const TOKEN_REFRESH_MARGIN_MS = 60_000

export class PandaApiAuthError extends Error {
  constructor(kind, message) {
    super(message)
    this.name = 'PandaApiAuthError'
    this.kind = kind
  }
}

function getTokenFromPayload(payload) {
  const token = typeof payload === 'string'
    ? payload
    : payload && typeof payload === 'object'
      ? payload.token ?? payload.accessToken ?? payload.access_token
      : null

  return typeof token === 'string' ? token.trim().replace(/^Bearer\s+/i, '') : ''
}

function getTokenExpiry(token, now) {
  const parts = token.split('.')
  if (parts.length !== 3) return now + TOKEN_CACHE_FALLBACK_MS

  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (Number.isFinite(claims.exp)) {
      return claims.exp * 1000 - TOKEN_REFRESH_MARGIN_MS
    }
  } catch {
    return now + TOKEN_CACHE_FALLBACK_MS
  }

  return now + TOKEN_CACHE_FALLBACK_MS
}

export function createPandaApiAuth({ apiBaseUrl, email, password, fetchImpl = fetch, now = Date.now }) {
  let cachedToken = ''
  let cachedTokenExpiry = 0
  let loginPromise

  async function login() {
    let response
    try {
      response = await fetchImpl(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(15_000),
      })
    } catch (error) {
      throw new PandaApiAuthError('connection', 'Não foi possível conectar ao login da PandaAPI.', { cause: error })
    }

    if (!response.ok) {
      throw new PandaApiAuthError(
        response.status === 401 || response.status === 403 ? 'credentials' : 'login',
        `O login da PandaAPI falhou (HTTP ${response.status}).`,
      )
    }

    let payload
    try {
      payload = await response.json()
    } catch (error) {
      throw new PandaApiAuthError('response', 'O login da PandaAPI retornou uma resposta inválida.', { cause: error })
    }

    const token = getTokenFromPayload(payload)
    if (!token || /[\r\n]/.test(token)) {
      throw new PandaApiAuthError('response', 'A resposta do login da PandaAPI não contém um token Bearer válido.')
    }

    cachedToken = token
    cachedTokenExpiry = getTokenExpiry(token, now())
    return token
  }

  return {
    isConfigured: Boolean(email && password),

    async getToken() {
      if (!email || !password) {
        throw new PandaApiAuthError('configuration', 'Configure PANDAAPI_EMAIL e PANDAAPI_PASSWORD no servidor.')
      }

      if (cachedToken && now() < cachedTokenExpiry) return cachedToken
      if (!loginPromise) {
        loginPromise = login().finally(() => {
          loginPromise = undefined
        })
      }
      return loginPromise
    },

    invalidate(token) {
      if (cachedToken === token) {
        cachedToken = ''
        cachedTokenExpiry = 0
      }
    },
  }
}
