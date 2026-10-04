import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_PANDAAPI_BASE_URL, resolvePandaApiBaseUrl } from '../server/panda-api-config.js'

test('uses the production API host by default', () => {
  assert.equal(resolvePandaApiBaseUrl(), DEFAULT_PANDAAPI_BASE_URL)
})

test('accepts the production and development API origins', () => {
  assert.equal(resolvePandaApiBaseUrl('https://api.pandaapi.com.br/'), 'https://api.pandaapi.com.br')
  assert.equal(resolvePandaApiBaseUrl('https://dev-api.pandaapi.com.br'), 'https://dev-api.pandaapi.com.br')
})

test('rejects non-HTTPS URLs and URLs containing a path or credentials', () => {
  for (const value of [
    'http://dev-api.pandaapi.com.br',
    'https://dev-api.pandaapi.com.br/v1',
    'https://user:password@dev-api.pandaapi.com.br',
    'not-a-url',
  ]) {
    assert.throws(() => resolvePandaApiBaseUrl(value), /PANDAAPI_BASE_URL inválida/)
  }
})
