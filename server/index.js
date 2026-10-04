import 'dotenv/config'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const distDirectory = path.join(projectRoot, 'dist')
const isProduction = process.argv[2] === 'production' || process.env.NODE_ENV === 'production'
const host = isProduction ? (process.env.HOST || '0.0.0.0') : '127.0.0.1'
const port = Number(process.env.PORT || (isProduction ? 3000 : process.env.PANDAAPI_PROXY_PORT || 3001))
const apiToken = process.env.PANDAAPI_TOKEN?.trim().replace(/^Bearer\s+/i, '')
const apiBaseUrl = 'https://pandaapi.com.br'

if (!apiToken) {
  console.warn('PANDAAPI_TOKEN não definido. As ferramentas mostrarão como configurar a integração no arquivo .env.')
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`PORT ou PANDAAPI_PROXY_PORT inválido: ${port}`)
}

if (isProduction && !existsSync(path.join(distDirectory, 'index.html'))) {
  throw new Error('Build não encontrado. Execute "npm run build" antes de iniciar o servidor de produção.')
}

const app = express()
app.disable('x-powered-by')

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1)
}

const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler(_request, response) {
    response.status(429).json({
      title: 'Limite de consultas atingido',
      detail: 'Aguarde um minuto antes de tentar novamente.',
    })
  },
})

const apiRouter = express.Router()

async function forwardToPandaApi(request, response, apiPath) {
  try {
    const upstream = await fetch(`${apiBaseUrl}${apiPath}`, {
      headers: {
        Accept: request.get('accept') || 'application/json, application/pdf, text/plain',
        Authorization: `Bearer ${apiToken}`,
      },
      signal: AbortSignal.timeout(30_000),
    })

    if (!upstream.ok) {
      const body = await upstream.text()
      let detail = ''

      try {
        const problem = JSON.parse(body)
        detail = problem.detail || problem.message || problem.title || ''
      } catch {
        detail = body.slice(0, 500)
      }

      const status = upstream.status >= 500 ? 502 : upstream.status
      const fallback = upstream.status === 401
        ? 'O token PandaAPI é inválido ou expirou. Atualize o PANDAAPI_TOKEN no ambiente do servidor.'
        : upstream.status === 429
          ? 'A PandaAPI atingiu o limite de consultas. Aguarde e tente novamente.'
          : `A PandaAPI recusou a solicitação (HTTP ${upstream.status}).`

      response.status(status).json({
        title: upstream.status === 401 ? 'Token PandaAPI inválido' : 'Falha na solicitação à PandaAPI',
        detail: detail || fallback,
      })
      return
    }

    const contentType = upstream.headers.get('content-type')
    const contentDisposition = upstream.headers.get('content-disposition')

    response.status(upstream.status)
    if (contentType) response.setHeader('Content-Type', contentType)
    if (contentDisposition) response.setHeader('Content-Disposition', contentDisposition)
    response.setHeader('Cache-Control', 'no-store')

    if (!upstream.body) {
      response.end()
      return
    }

    await pipeline(Readable.fromWeb(upstream.body), response)
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    const routePath = `${request.baseUrl}${request.route?.path ?? '/[rota desconhecida]'}`
    console.error(`Falha no proxy ${request.method} ${routePath}:`, error)

    if (!response.headersSent) {
      response.status(timedOut ? 504 : 502).json({
        title: timedOut ? 'A PandaAPI demorou para responder' : 'Não foi possível conectar à PandaAPI',
        detail: timedOut
          ? 'Aguarde e tente novamente.'
          : 'Verifique a conexão do servidor e tente novamente.',
      })
      return
    }

    if (!response.writableEnded) response.destroy(error)
  }
}

apiRouter.use(apiLimiter)
apiRouter.use((_request, response, next) => {
  if (!apiToken) {
    response.status(503).json({
      title: 'API ainda não configurada',
      detail: 'Adicione seu token de serviço à variável PANDAAPI_TOKEN do arquivo .env e reinicie o servidor.',
    })
    return
  }
  next()
})

apiRouter.get('/generate/cpf', (request, response) => {
  void forwardToPandaApi(request, response, '/generate/cpf')
})

apiRouter.get('/generate/cnpj/numeric', (request, response) => {
  void forwardToPandaApi(request, response, '/generate/cnpj/numeric')
})

apiRouter.get('/generate/cnpj/alphanumeric', (request, response) => {
  void forwardToPandaApi(request, response, '/generate/cnpj/alphanumeric')
})

apiRouter.get('/validate/cpf/:cpf', (request, response, next) => {
  const cpf = request.params.cpf.replace(/\D/g, '')
  if (cpf.length !== 11) {
    response.status(400).json({ title: 'CPF inválido', detail: 'Informe um CPF com 11 dígitos.' })
    return
  }
  next()
}, (request, response) => {
  const cpf = request.params.cpf.replace(/\D/g, '')
  void forwardToPandaApi(request, response, `/validate/cpf/${cpf}`)
})

apiRouter.get('/validate/cnpj/:cnpj', (request, response, next) => {
  const cnpj = request.params.cnpj.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cnpj.length !== 14) {
    response.status(400).json({ title: 'CNPJ inválido', detail: 'Informe um CNPJ com 14 caracteres.' })
    return
  }
  request.params.cnpj = cnpj
  next()
}, (request, response) => {
  void forwardToPandaApi(request, response, `/validate/cnpj/${request.params.cnpj}`)
})

apiRouter.get('/cnpj/:cnpj', (request, response, next) => {
  const cnpj = request.params.cnpj.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cnpj.length !== 14) {
    response.status(400).json({ title: 'CNPJ inválido', detail: 'Informe um CNPJ com 14 caracteres.' })
    return
  }
  request.params.cnpj = cnpj
  next()
}, (request, response) => {
  void forwardToPandaApi(request, response, `/cnpj/${request.params.cnpj}`)
})

apiRouter.get('/cnpj/:cnpj/pdf', (request, response, next) => {
  const cnpj = request.params.cnpj.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cnpj.length !== 14) {
    response.status(400).json({ title: 'CNPJ inválido', detail: 'Informe um CNPJ com 14 caracteres.' })
    return
  }
  request.params.cnpj = cnpj
  next()
}, (request, response) => {
  void forwardToPandaApi(request, response, `/cnpj/${request.params.cnpj}/pdf`)
})

apiRouter.get('/cnpj/:cnpj/pdf/file', (request, response, next) => {
  const cnpj = request.params.cnpj.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cnpj.length !== 14) {
    response.status(400).json({ title: 'CNPJ inválido', detail: 'Informe um CNPJ com 14 caracteres.' })
    return
  }
  request.params.cnpj = cnpj
  next()
}, (request, response) => {
  void forwardToPandaApi(request, response, `/cnpj/${request.params.cnpj}/pdf/file`)
})

apiRouter.all('*', (_request, response) => {
  response.status(404).json({ title: 'Rota PandaAPI não encontrada' })
})

app.use('/api', apiRouter)

if (isProduction) {
  app.use(express.static(distDirectory, { index: false }))
  app.get('*', (_request, response) => {
    response.sendFile(path.join(distDirectory, 'index.html'))
  })
}

const server = createServer(app)
server.listen(port, host, () => {
  console.log(`Servidor PandaAPI ${isProduction ? '' : 'proxy '}em http://${host}:${port}`)
})
