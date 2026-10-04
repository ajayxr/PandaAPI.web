<script setup>
import { computed, nextTick, ref } from 'vue'
import { findApiDocument, findApiValidation, formatLookupResult } from './api-formatters.js'
import PandaMark from './components/PandaMark.vue'

const pandaApiSwaggerUrl = import.meta.env.VITE_PANDAAPI_SWAGGER_URL || 'https://api.pandaapi.com.br/swagger/index.html'

const tools = [
  { id: 'generate-cpf', name: 'Gerador de CPF', description: 'CPFs válidos para os seus testes.', category: 'GERADORES', icon: 'sparkles', label: 'CPF' },
  { id: 'generate-cnpj', name: 'Gerador de CNPJ', description: 'CNPJs numéricos prontos para usar.', category: 'GERADORES', icon: 'building', label: 'CNPJ' },
  { id: 'generate-cnpj-alpha', name: 'CNPJ com letras', description: 'Experimente o novo CNPJ alfanumérico.', category: 'GERADORES', icon: 'letters', label: 'NOVO' },
  { id: 'validate-cpf', name: 'Validador de CPF', description: 'Confira rapidamente os dígitos verificadores.', category: 'VALIDADORES', icon: 'check', label: 'CPF' },
  { id: 'validate-cnpj', name: 'Validador de CNPJ', description: 'Valide CNPJs numéricos ou alfanuméricos.', category: 'VALIDADORES', icon: 'check', label: 'CNPJ' },
  { id: 'lookup-cnpj', name: 'Consultar CNPJ', description: 'Consulte dados cadastrais e prepare um PDF.', category: 'CONSULTAS', icon: 'search', label: 'API' },
]

const activeTool = ref(null)
const mobileMenuOpen = ref(false)
const generatedDocument = ref('')
const validatorInput = ref('')
const validation = ref(null)
const lookupInput = ref('')
const lookupResult = ref(null)
const lookupCompletedCnpj = ref('')
const apiBusy = ref(false)
const pdfBusy = ref(false)
const notice = ref('')
let noticeTimeout

const selectedTool = computed(() => tools.find((tool) => tool.id === activeTool.value))
const isGenerator = computed(() => activeTool.value?.startsWith('generate-'))
const isValidator = computed(() => activeTool.value?.startsWith('validate-'))
const isLookup = computed(() => activeTool.value === 'lookup-cnpj')
const documentLabel = computed(() => activeTool.value === 'generate-cpf' ? 'CPF' : 'CNPJ')
const lookupPresentation = computed(() => lookupResult.value
  ? formatLookupResult(lookupResult.value, lookupCompletedCnpj.value)
  : null)

function formatDocument(value, type) {
  if (type === 'CPF') {
    return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }
  return value.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5')
}

function explainApiError(status, payload, path) {
  const detail = payload && typeof payload === 'object'
    ? payload.detail || payload.message || payload.title
    : typeof payload === 'string' ? payload : ''

  if (status === 400) {
    if (typeof detail === 'string' && detail.trim() && !/\bHTTP\s+400\b|recusou a solicitação/i.test(detail)) {
      return detail.trim().slice(0, 300)
    }
    if (path.startsWith('/validate/cpf/')) return 'Este CPF não é válido. Confira os números informados e tente novamente.'
    if (path.startsWith('/validate/cnpj/')) return 'Este CNPJ não é válido. Confira os caracteres informados e tente novamente.'
    if (path.startsWith('/cnpj/')) return 'Não foi possível consultar esse CNPJ. Confira o número e tente novamente.'
    return 'Não foi possível processar os dados informados. Confira os dados e tente novamente.'
  }
  if (typeof detail === 'string' && detail.trim()) return detail.trim().slice(0, 300)
  if (status === 401) return 'Falha na autenticação da PandaAPI. Verifique as credenciais configuradas no servidor.'
  if (status === 429) return 'Limite de consultas atingido. Aguarde um minuto e tente novamente.'
  if (status === 503) return 'Integração não configurada. Verifique as credenciais da PandaAPI no servidor.'
  return `A PandaAPI respondeu com HTTP ${status}. Tente novamente.`
}

async function requestPandaApi(path, { download = false } = {}) {
  let response
  try {
    response = await fetch(`/api${path}`, {
      headers: { Accept: download ? 'application/pdf, application/octet-stream, application/json' : 'application/json, text/plain' },
    })
  } catch {
    throw new Error('Não foi possível acessar o servidor da integração. Reinicie o projeto com npm run dev.')
  }

  const contentType = response.headers.get('content-type') || ''
  if (!response.ok) {
    const text = await response.text()
    let payload = text
    try {
      payload = text ? JSON.parse(text) : ''
    } catch {
      payload = text
    }
    const error = new Error(explainApiError(response.status, payload, path))
    error.status = response.status
    throw error
  }

  if (download) return { blob: await response.blob(), contentType, payload: null }

  const text = await response.text()
  let payload = text
  try {
    payload = text ? JSON.parse(text) : ''
  } catch {
    payload = text
  }
  return { payload, contentType }
}

function openTool(id) {
  activeTool.value = id
  generatedDocument.value = ''
  validatorInput.value = ''
  validation.value = null
  lookupInput.value = ''
  lookupResult.value = null
  lookupCompletedCnpj.value = ''
  apiBusy.value = false
  pdfBusy.value = false
  nextTick(() => document.getElementById('tool-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
}

async function generateDocument() {
  if (apiBusy.value) return
  const toolId = activeTool.value
  const endpoints = {
    'generate-cpf': ['/generate/cpf', 11],
    'generate-cnpj': ['/generate/cnpj/numeric', 14],
    'generate-cnpj-alpha': ['/generate/cnpj/alphanumeric', 14],
  }
  const endpoint = endpoints[toolId]
  if (!endpoint) return

  apiBusy.value = true
  generatedDocument.value = ''
  try {
    const { payload } = await requestPandaApi(endpoint[0])
    if (activeTool.value !== toolId) return
    const document = findApiDocument(payload, endpoint[1])
    if (!document) {
      throw new Error('A PandaAPI respondeu, mas não foi possível reconhecer o documento. Confira o formato da resposta no Swagger.')
    }
    generatedDocument.value = formatDocument(document, toolId === 'generate-cpf' ? 'CPF' : 'CNPJ')
  } catch (error) {
    if (activeTool.value === toolId) showNotice(error.message)
  } finally {
    if (activeTool.value === toolId) apiBusy.value = false
  }
}

async function validateDocument() {
  if (apiBusy.value) return
  const toolId = activeTool.value
  const isCpf = toolId === 'validate-cpf'
  const rawInput = validatorInput.value.trim()
  if (!rawInput) {
    validation.value = { valid: false, message: 'Digite um documento para validar.' }
    return
  }

  const allowedCharacters = isCpf ? /^[\d.\-\s]+$/ : /^[\dA-Z./\-\s]+$/i
  if (!allowedCharacters.test(rawInput)) {
    validation.value = { valid: false, message: 'Confira os caracteres do documento informado.' }
    return
  }

  const normalized = isCpf
    ? rawInput.replace(/\D/g, '')
    : rawInput.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const expectedLength = isCpf ? 11 : 14
  if (normalized.length !== expectedLength) {
    validation.value = {
      valid: false,
      message: `Um ${isCpf ? 'CPF' : 'CNPJ'} deve ter ${isCpf ? '11 números' : '14 caracteres'}.`,
    }
    return
  }

  apiBusy.value = true
  validation.value = null
  try {
    const encoded = encodeURIComponent(normalized)
    const { payload } = await requestPandaApi(`/validate/${isCpf ? 'cpf' : 'cnpj'}/${encoded}`)
    if (activeTool.value !== toolId) return
    const valid = findApiValidation(payload)
    validation.value = {
      valid: valid === true,
      message: valid === true
        ? 'A PandaAPI confirmou que o documento é válido.'
        : valid === false
          ? 'A PandaAPI informou que o documento é inválido.'
          : 'A API não informou se o documento é válido. Confira a documentação ou tente novamente.',
    }
  } catch (error) {
    if (activeTool.value === toolId) {
      if (error.status === 400) {
        validation.value = { valid: false, message: error.message }
      } else {
        showNotice(error.message)
      }
    }
  } finally {
    if (activeTool.value === toolId) apiBusy.value = false
  }
}

async function copyDocument() {
  try {
    await navigator.clipboard.writeText(generatedDocument.value)
    showNotice('Documento copiado para a área de transferência.')
  } catch {
    showNotice('Não foi possível copiar. Selecione e copie o documento.')
  }
}

function showNotice(message) {
  notice.value = message
  clearTimeout(noticeTimeout)
  noticeTimeout = setTimeout(() => { notice.value = '' }, 3200)
}

async function requestLookup() {
  if (apiBusy.value) return
  const toolId = activeTool.value
  if (!lookupInput.value.trim()) {
    showNotice('Digite um CNPJ para iniciar a consulta.')
    return
  }

  const cnpj = lookupInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!/^[A-Z0-9]{14}$/.test(cnpj)) {
    showNotice('Informe um CNPJ com 14 caracteres.')
    return
  }

  apiBusy.value = true
  lookupResult.value = null
  lookupCompletedCnpj.value = ''
  try {
    const { payload } = await requestPandaApi(`/cnpj/${encodeURIComponent(cnpj)}`)
    if (activeTool.value !== toolId) return
    lookupResult.value = payload
    lookupCompletedCnpj.value = cnpj
  } catch (error) {
    if (activeTool.value === toolId) showNotice(error.message)
  } finally {
    if (activeTool.value === toolId) apiBusy.value = false
  }
}

async function printReport() {
  if (pdfBusy.value) return
  const cnpj = lookupCompletedCnpj.value
  if (!isLookup.value || !cnpj) {
    showNotice('Consulte um CNPJ antes de gerar o relatório PDF.')
    return
  }

  pdfBusy.value = true
  try {
    const encoded = encodeURIComponent(cnpj)
    const result = await requestPandaApi(`/cnpj/${encoded}/pdf/file`, { download: true })
    const signature = await result.blob.slice(0, 5).text()
    if (!result.contentType.toLowerCase().includes('pdf') && signature !== '%PDF-') {
      throw new Error('A PandaAPI não retornou o arquivo PDF esperado. Tente novamente ou consulte o suporte.')
    }

    const objectUrl = URL.createObjectURL(result.blob)
    const download = document.createElement('a')
    download.href = objectUrl
    download.download = `pandaapi-cnpj-${cnpj}.pdf`
    document.body.append(download)
    download.click()
    download.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    showNotice('Relatório PDF baixado.')
  } catch (error) {
    showNotice(error.message)
  } finally {
    pdfBusy.value = false
  }
}

function resetTool() {
  activeTool.value = null
}
</script>

<template>
  <div>
    <header class="site-header">
      <a class="brand" href="#" aria-label="PandaAPI, início">
        <PandaMark />
        <span>Panda<span class="brand-light">API</span></span>
        <span class="brand-tag">TOOLS</span>
      </a>

      <nav class="main-nav" :class="{ 'is-open': mobileMenuOpen }" aria-label="Navegação principal" @click="mobileMenuOpen = false">
        <a href="#ferramentas">Ferramentas</a>
        <a href="#sobre">Sobre</a>
        <a :href="pandaApiSwaggerUrl" target="_blank" rel="noreferrer">Documentação <span aria-hidden="true">↗</span></a>
        <a href="https://github.com/ajayxr/PandaAPI.web" target="_blank" rel="noreferrer">GitHub Web <span aria-hidden="true">↗</span></a>
        <a href="https://github.com/ajayxr/PandaAPI" target="_blank" rel="noreferrer">GitHub API <span aria-hidden="true">↗</span></a>
      </nav>

      <a class="header-cta" href="#ferramentas">
        Começar a usar <span aria-hidden="true">↗</span>
      </a>
      <button class="mobile-menu" type="button" :aria-expanded="mobileMenuOpen" aria-label="Abrir menu" @click="mobileMenuOpen = !mobileMenuOpen">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
      </button>
    </header>

    <main>
      <section class="hero page-shell">
        <div class="hero-copy">
          <div class="eyebrow"><span class="eyebrow-dot"></span> UM KIT DE FERRAMENTAS PARA ANALISTAS, DEVS & QA</div>
          <h1>Menos burocracia<br><span>Mais tempo<br class="mobile-break" /> construindo.</span></h1>
          <p>Gere dados para testes, valide documentos e consulte informações reais. Tudo em uma API simples, gratuita e sem cadastro.</p>
          <div class="hero-actions">
            <a class="button button-primary" href="#ferramentas">Explorar ferramentas <span aria-hidden="true">↘</span></a>
            <a class="text-link" href="#sobre">Conheça a PandaAPI <span aria-hidden="true">→</span></a>
          </div>
          <div class="hero-proof">
            <span class="proof-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none"><path d="m5.2 10.1 3.1 3 6.5-6.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </span>
            <span><strong>Sem cadastro.</strong> Sem enrolação. É só usar.</span>
          </div>
        </div>

        <div class="hero-art" aria-label="Prévia de uma ferramenta PandaAPI">
          <div class="art-glow"></div>
          <div class="code-window">
            <div class="window-top">
              <span class="window-lights"><i></i><i></i><i></i></span>
              <span class="window-title">pandaapi · playground</span>
              <span class="window-menu">···</span>
            </div>
            <div class="code-content">
              <div class="code-line"><span class="line-number">01</span><span><span class="code-dim">// chamada real pelo servidor seguro</span></span></div>
              <div class="code-line"><span class="line-number">02</span><span><b>const</b> response = <b>await</b> fetch(</span></div>
              <div class="code-line"><span class="line-number">03</span><span>  <u>'/api/generate/cpf'</u></span></div>
              <div class="code-line"><span class="line-number">04</span><span>)</span></div>
              <div class="code-line"><span class="line-number">05</span><span><b>if</b> (!response.ok) <b>throw new</b> <i>Error</i>()</span></div>
              <div class="code-line"><span class="line-number">06</span><span><b>const</b> { cpf } = <b>await</b> response.<i>json</i>()</span></div>
            </div>
            <div class="code-bottom">
              <span><i class="status-pulse"></i> ENDPOINT PANDAAPI REAL</span>
              <span>API via proxy do servidor</span>
            </div>
          </div>
          <div class="float-card float-card-top"><span class="float-spark">✳</span><span>Validação<br /><strong>via API própria</strong></span></div>
          <div class="float-card float-card-bottom"><span class="float-check">✓</span><span>Pronto para<br /><strong>o próximo commit</strong></span></div>
          <div class="art-orbit orbit-one"></div>
          <div class="art-orbit orbit-two"></div>
          <span class="hero-star star-one">✳</span>
          <span class="hero-star star-two">✳</span>
        </div>

        <div class="hero-scroll"><span></span> DESCUBRA O QUE VOCÊ PODE FAZER</div>
      </section>

      <section id="ferramentas" class="tools-section page-shell">
        <div class="section-heading">
          <div>
            <div class="eyebrow section-eyebrow"><span class="eyebrow-dot"></span> MENOS SETUP, MAIS SHIP</div>
            <h2>Ferramentas que <span>resolvem.</span></h2>
            <p>O essencial para testar documentos brasileiros sem sair do seu fluxo.</p>
          </div>
          <div class="tools-count"><span>06</span> ferramentas <span class="count-divider">/</span> e contando</div>
        </div>

        <div class="tools-grid">
          <button
            v-for="tool in tools"
            :key="tool.id"
            class="tool-card"
            :class="{ 'tool-card-active': activeTool === tool.id }"
            type="button"
            @click="openTool(tool.id)"
          >
            <span class="tool-card-top">
              <span class="tool-icon" :class="`icon-${tool.icon}`">
                <svg v-if="tool.icon === 'sparkles'" viewBox="0 0 24 24" fill="none"><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Zm7 11 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg>
                <svg v-else-if="tool.icon === 'building'" viewBox="0 0 24 24" fill="none"><path d="M4 21h16M6 21V5l6-2 6 2v16M9 8h.01M15 8h.01M9 12h.01M15 12h.01M10 21v-5h4v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
                <svg v-else-if="tool.icon === 'letters'" viewBox="0 0 24 24" fill="none"><path d="M4 19 10 5l6 14M6 15h8M15 19l3.5-9 3.5 9m-5.8-2h4.6M5 4h.01M19 5h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
                <svg v-else-if="tool.icon === 'check'" viewBox="0 0 24 24" fill="none"><path d="M8 12.5 10.5 15 16 9m4 3a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                <svg v-else viewBox="0 0 24 24" fill="none"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" stroke-width="1.6" /><path d="m16 16 4.5 4.5M8 10.8h5.6M10.8 8v5.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
              </span>
              <span class="tool-label" :class="{ 'tool-label-highlight': tool.label === 'NOVO' }">{{ tool.label }}</span>
            </span>
            <span class="tool-category">{{ tool.category }}</span>
            <span class="tool-name">{{ tool.name }}</span>
            <span class="tool-description">{{ tool.description }}</span>
            <span class="tool-card-bottom"><span>Experimentar ferramenta</span><span class="tool-arrow" aria-hidden="true">↗</span></span>
          </button>
        </div>

        <Transition name="workspace">
          <section v-if="selectedTool" id="tool-workspace" class="workspace" :aria-label="selectedTool.name">
            <div class="workspace-heading">
              <div class="workspace-heading-left">
                <button class="back-button" type="button" aria-label="Fechar ferramenta" @click="resetTool">←</button>
                <div>
                  <div class="workspace-kicker">PLAYGROUND <span>/</span> {{ selectedTool.category }}</div>
                  <h3>{{ selectedTool.name }}</h3>
                </div>
              </div>
              <span class="local-badge"><span class="eyebrow-dot"></span> GRÁTIS · SEM CADASTRO</span>
            </div>

            <div v-if="isGenerator" class="workspace-body">
              <div class="workspace-explanation">
                <span class="workspace-number">01</span>
                <h4>Dados de teste<br />em um clique.</h4>
                <p>Gere documentos válidos diretamente pela API PandaAPI.</p>
                <div class="privacy-note"><span>◈</span> Não salvamos logs, utilize sem preocupação.</div>
              </div>
              <div class="workspace-form">
                <label class="field-label">SEU DOCUMENTO DE TESTE</label>
                <div class="result-box" :class="{ 'result-box-ready': generatedDocument }">
                  <span class="result-value" :class="{ 'result-placeholder': !generatedDocument }">{{ apiBusy ? 'Consultando a PandaAPI…' : generatedDocument || 'Clique para gerar um número válido' }}</span>
                  <button v-if="generatedDocument" class="copy-button" type="button" aria-label="Copiar documento" @click="copyDocument">
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="7" y="7" width="9" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4" /><path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v8A1.5 1.5 0 0 0 4.5 14H7" stroke="currentColor" stroke-width="1.4" /></svg>
                  </button>
                </div>
                <button class="button button-primary generate-button" type="button" :disabled="apiBusy" @click="generateDocument">
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5v15M2.5 10h15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
                  Gerar {{ documentLabel }} válido
                </button>
                <p class="form-footnote"><span>✳</span> Para testes e desenvolvimento. Não use como documento real.</p>
              </div>
            </div>

            <div v-else-if="isValidator" class="workspace-body">
              <div class="workspace-explanation">
                <span class="workspace-number">02</span>
                <h4>Valide antes<br />de seguir.</h4>
                <p>Peça à PandaAPI para conferir os dígitos verificadores do documento.</p>
                <div class="privacy-note"><span>◈</span>A validação matemática verifica se o CPF/CNPJ segue corretamente o algoritmo dos dígitos verificadores (DV). Isso não confirma se o documento está cadastrado ou ativo na Receita Federal.</div>
              </div>
              <form class="workspace-form" @submit.prevent="validateDocument">
                <label class="field-label" for="validator-input">DOCUMENTO PARA VALIDAR</label>
                <input
                  id="validator-input"
                  v-model="validatorInput"
                  class="text-field"
                  :placeholder="activeTool === 'validate-cpf' ? '000.000.000-00' : '00.000.000/0000-00'"
                  :maxlength="activeTool === 'validate-cpf' ? 14 : 18"
                  autocomplete="off"
                />
                <button class="button button-primary generate-button" type="submit" :disabled="apiBusy">
                  Verificar {{ activeTool === 'validate-cpf' ? 'CPF' : 'CNPJ' }} <span aria-hidden="true">→</span>
                </button>
                <div v-if="validation" class="validation-result" :class="validation.valid === true ? 'validation-success' : validation.valid === false ? 'validation-error' : 'validation-unknown'" role="status" aria-live="polite">
                  <span aria-hidden="true">{{ validation.valid === null ? 'i' : validation.valid ? '✓' : '!' }}</span>{{ validation.message }}
                </div>
                <p v-else class="form-footnote"><span>✳</span> Aceita documentos com ou sem pontuação.</p>
              </form>
            </div>

            <div v-else-if="isLookup" class="workspace-body">
              <div class="workspace-explanation">
                <span class="workspace-number">03</span>
                <h4>Dados reais.<br />Sem complicação.</h4>
                <p>Consulte dados públicos e gere o relatório PDF usando a API PandaAPI.</p>
                <div class="privacy-note"><span>◈</span>Dados fornecidos por meio da integração com a CNPJ.ai.</div>
              </div>
              <form class="workspace-form" @submit.prevent="requestLookup">
                <label class="field-label" for="lookup-input">CNPJ DA EMPRESA</label>
                <input
                  id="lookup-input"
                  v-model="lookupInput"
                  class="text-field"
                  placeholder="00.000.000/0000-00"
                  maxlength="18"
                  autocomplete="off"
                  inputmode="numeric"
                />
                <button class="button button-primary generate-button" type="submit" :disabled="apiBusy">Consultar CNPJ <span aria-hidden="true">→</span></button>
                <div class="api-pending" role="status"><span class="api-pending-dot"></span><span>Consultas e downloads são encaminhados ao servidor; o token Bearer não é exposto ao navegador.</span></div>
                <div v-if="lookupPresentation" class="api-data-result" aria-live="polite">
                  <div class="api-result-heading">
                    <div>
                      <h4>{{ lookupPresentation.companyName }}</h4>
                      <p>CNPJ {{ lookupPresentation.cnpj }}</p>
                    </div>
                    <span v-if="lookupPresentation.status" class="api-result-status" :class="`status-${lookupPresentation.statusTone}`">
                      {{ lookupPresentation.status }}
                    </span>
                  </div>
                  <section v-for="section in lookupPresentation.sections" :key="section.title" class="api-result-section">
                    <h5>{{ section.title }}</h5>
                    <dl class="api-result-fields">
                      <div v-for="field in section.fields" :key="field.label" class="api-result-field">
                        <dt>{{ field.label }}</dt>
                        <dd v-if="Array.isArray(field.value)">
                          <ul>
                            <li v-for="item in field.value" :key="item">{{ item }}</li>
                          </ul>
                        </dd>
                        <dd v-else>{{ field.value }}</dd>
                      </div>
                    </dl>
                  </section>
                  <p v-if="!lookupPresentation.sections.length" class="api-result-empty">
                    A API confirmou a consulta, mas não retornou informações cadastrais para exibir.
                  </p>
                </div>
                <button class="pdf-button" type="button" :disabled="pdfBusy || apiBusy || !lookupCompletedCnpj" @click="printReport">
                  <span aria-hidden="true">↧</span>
                  {{ pdfBusy ? 'Gerando relatório…' : 'Gerar relatório em PDF' }}
                </button>
              </form>
            </div>
          </section>
        </Transition>
      </section>

      <section id="sobre" class="about-section">
        <div class="about-inner page-shell">
          <div class="about-main">
            <div class="eyebrow"><span class="eyebrow-dot"></span> FERRAMENTAS FEITAS PARA O SEU DIA A DIA</div>
            <h2>Seu próximo teste<br />começa <span>mais leve.</span></h2>
            <p>A PandaAPI Tools foi criada para quem testa, constrói e coloca software no mundo. Sem burocracia: abra, use e continue o seu trabalho.</p>
            <a class="button button-primary" href="#ferramentas">Encontrar minha ferramenta <span aria-hidden="true">↗</span></a>
          </div>
          <div class="about-points">
            <div class="about-point"><span class="point-index">01</span><div><strong>Feita para devs & QA</strong><p>Dados de teste válidos para seu ambiente de desenvolvimento.</p></div><span class="point-check">✓</span></div>
            <div class="about-point"><span class="point-index">02</span><div><strong>Privacidade por padrão</strong><p>Geração e validação feitas localmente, sem enviar seus dados.</p></div><span class="point-check">✓</span></div>
            <div class="about-point"><span class="point-index">03</span><div><strong>Sem barreiras</strong><p>Grátis, direto no navegador e sem precisar criar uma conta.</p></div><span class="point-check">✓</span></div>
          </div>
        </div>
      </section>
    </main>

    <footer class="site-footer page-shell">
      <a class="brand footer-brand" href="#" aria-label="PandaAPI, início">
        <PandaMark />
        <span>Panda<span class="brand-light">API</span></span><span class="brand-tag">TOOLS</span>
      </a>
      <p>Feito para quem constrói coisas legais. <span>✳</span></p>
      <span class="footer-copyright">© 2026 PandaAPI Tools</span>
    </footer>

    <Transition name="toast">
      <div v-if="notice" class="toast-message" role="status" aria-live="polite">{{ notice }}</div>
    </Transition>
  </div>
</template>
