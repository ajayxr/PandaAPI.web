import assert from 'node:assert/strict'
import test from 'node:test'
import { createPandaApiAuth, PandaApiAuthError } from '../server/panda-api-auth.js'

const apiBaseUrl = 'https://pandaapi.example'

function createJwt(expiry) {
  const claims = Buffer.from(JSON.stringify({ exp: expiry })).toString('base64url')
  return `header.${claims}.signature`
}

test('logs in using email and password, then reuses the Bearer token', async () => {
  const token = createJwt(2_000)
  const requests = []
  const auth = createPandaApiAuth({
    apiBaseUrl,
    email: 'service@example.com',
    password: 'secret-password',
    now: () => 1_000_000,
    fetchImpl: async (...args) => {
      requests.push(args)
      return Response.json({ token })
    },
  })

  assert.equal(await auth.getToken(), token)
  assert.equal(await auth.getToken(), token)
  assert.equal(requests.length, 1)
  assert.equal(requests[0][0], `${apiBaseUrl}/auth/login`)
  assert.equal(requests[0][1].method, 'POST')
  assert.deepEqual(JSON.parse(requests[0][1].body), {
    email: 'service@example.com',
    password: 'secret-password',
  })
})

test('accepts accessToken and refreshes an expired cached token', async () => {
  let currentTime = 1_000_000
  let loginCount = 0
  const auth = createPandaApiAuth({
    apiBaseUrl,
    email: 'service@example.com',
    password: 'secret-password',
    now: () => currentTime,
    fetchImpl: async () => {
      loginCount += 1
      return Response.json({ accessToken: createJwt(loginCount === 1 ? 1_100 : 2_000) })
    },
  })

  await auth.getToken()
  currentTime = 1_100_000
  await auth.getToken()
  assert.equal(loginCount, 2)
})

test('does not expose a successful response when login has no token', async () => {
  const auth = createPandaApiAuth({
    apiBaseUrl,
    email: 'service@example.com',
    password: 'secret-password',
    fetchImpl: async () => Response.json({ message: 'ok' }),
  })

  await assert.rejects(auth.getToken(), (error) => {
    assert.ok(error instanceof PandaApiAuthError)
    assert.equal(error.kind, 'response')
    return true
  })
})

test('reports missing credentials without attempting login', async () => {
  let loginAttempted = false
  const auth = createPandaApiAuth({
    apiBaseUrl,
    email: '',
    password: '',
    fetchImpl: async () => {
      loginAttempted = true
      return Response.json({})
    },
  })

  assert.equal(auth.isConfigured, false)
  await assert.rejects(auth.getToken(), (error) => {
    assert.ok(error instanceof PandaApiAuthError)
    assert.equal(error.kind, 'configuration')
    return true
  })
  assert.equal(loginAttempted, false)
})
