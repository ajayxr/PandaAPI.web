function normalizeKey(value) {
  return value.toLowerCase().replace(/[_\-\s]/g, '')
}

function getField(record, ...aliases) {
  if (!record || typeof record !== 'object') return undefined

  const normalizedAliases = aliases.map(normalizeKey)
  for (const [key, value] of Object.entries(record)) {
    if (!normalizedAliases.includes(normalizeKey(key))) continue
    if (value === null || value === undefined || value === '') continue
    return value
  }

  return undefined
}

function getDescription(record, ...aliases) {
  return getField(getField(record, 'descricoes', 'descriptions'), ...aliases)
    ?? getField(record, ...aliases)
}

function printable(value) {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'string') return value.trim() || undefined
  if (typeof value === 'number') {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)
  }
  return undefined
}

function formatDate(value) {
  if (typeof value !== 'string') return printable(value)
  const isoDate = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`
  return printable(value)
}

function formatCurrency(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined

  const text = String(value).trim()
  const normalized = typeof value === 'number' || !text.includes(',')
    ? text
    : text.replace(/\./g, '').replace(',', '.')
  const amount = Number(normalized)

  if (!Number.isFinite(amount)) return printable(value)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
}

function formatCnae(value) {
  const code = String(value ?? '').replace(/\D/g, '')
  return /^\d{7}$/.test(code) ? `${code.slice(0, 4)}-${code[4]}/${code.slice(5)}` : printable(value)
}

function formatApiCnpj(value) {
  const cnpj = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cnpj.length !== 14) return printable(value)
  return cnpj.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5')
}

function describeCnae(value, code) {
  const description = printable(value)
  const formattedCode = formatCnae(code)
  if (description && formattedCode) return `${description} (CNAE ${formattedCode})`
  return description || (formattedCode ? `CNAE ${formattedCode}` : undefined)
}

function addSection(sections, title, fields) {
  const visibleFields = fields.filter((field) => {
    if (Array.isArray(field.value)) {
      field.value = field.value.map(printable).filter(Boolean)
      return field.value.length > 0
    }
    field.value = printable(field.value)
    return Boolean(field.value)
  })

  if (visibleFields.length) sections.push({ title, fields: visibleFields })
}

export function findApiDocument(value, length) {
  if (typeof value === 'string') {
    const candidates = value.toUpperCase().match(/[A-Z0-9][A-Z0-9./-]*/g) || []
    return candidates
      .map((candidate) => candidate.replace(/[^A-Z0-9]/g, ''))
      .find((candidate) => candidate.length === length) || ''
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const document = findApiDocument(item, length)
      if (document) return document
    }
    return ''
  }

  if (value && typeof value === 'object') {
    const preferredKeys = ['cpf', 'cnpj', 'document', 'documento', 'number', 'numero', 'value', 'result', 'resultado', 'data']
    for (const key of preferredKeys) {
      if (key in value) {
        const document = findApiDocument(value[key], length)
        if (document) return document
      }
    }
    for (const [key, item] of Object.entries(value)) {
      if (!preferredKeys.includes(key.toLowerCase())) {
        const document = findApiDocument(item, length)
        if (document) return document
      }
    }
  }

  return ''
}

function classifyValidationMessage(value) {
  if (typeof value !== 'string') return null

  const message = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (/\b(?:false|invalid|invalido|invalida|nao(?:\s+e)?\s+valido|nao(?:\s+e)?\s+valida)\b/.test(message)) {
    return false
  }
  if (/\b(?:true|valid|valido|valida)\b/.test(message)) return true
  return null
}

export function findApiValidation(value) {
  if (typeof value === 'boolean') return value
  const directResult = classifyValidationMessage(value)
  if (directResult !== null) return directResult

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findApiValidation(item)
      if (result !== null) return result
    }
    return null
  }

  if (value && typeof value === 'object') {
    for (const key of ['valid', 'isValid', 'is_valid', 'valido', 'isValido']) {
      const result = findApiValidation(getField(value, key))
      if (result !== null) return result
    }
    for (const key of ['message', 'mensagem', 'status', 'resultado', 'detail', 'descricao', 'description']) {
      const result = classifyValidationMessage(getField(value, key))
      if (result !== null) return result
    }
  }

  return null
}

export function displayApiPayload(value) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function formatLookupResult(response, requestedCnpj) {
  const root = getField(response, 'dados', 'data') ?? response
  const company = getField(root, 'empresa', 'company') ?? {}
  const establishment = getField(root, 'estabelecimento', 'establishment', 'branch') ?? {}
  const taxRegime = getField(company, 'simples', 'taxRegime', 'tax_regime') ?? {}
  const partners = getField(company, 'socios', 'partners') ?? {}
  const metadata = getField(response, 'meta', 'metadata') ?? {}

  const registeredCnpj = getField(establishment, 'cnpj', 'documento')
    ?? getField(root, 'cnpj', 'documento')
    ?? requestedCnpj
  const status = getDescription(establishment, 'situacao_cadastral', 'situacao', 'status')
  const companyName = printable(getField(company, 'razao_social', 'legal_name', 'nome_empresarial'))
    ?? printable(getField(establishment, 'nome_fantasia', 'trade_name'))
    ?? 'Dados da empresa'

  let statusTone = 'neutral'
  if (typeof status === 'string') {
    const normalizedStatus = status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    if (/\b(?:ativa|active)\b/.test(normalizedStatus) || /\bem atividade\b/.test(normalizedStatus)) statusTone = 'positive'
    else if (/\b(?:suspensa|inapta|baixada|nula|inactive|suspended|closed)\b/.test(normalizedStatus)) statusTone = 'warning'
  }

  const secondaryActivities = getField(establishment, 'descricoes', 'descriptions')
  const activities = secondaryActivities && typeof secondaryActivities === 'object'
    ? Object.entries(secondaryActivities)
      .filter(([key]) => key.toLowerCase().startsWith('cnae_secundaria:'))
      .map(([, value]) => printable(value))
      .filter(Boolean)
    : []

  const addressLine = [
    [printable(getField(establishment, 'tipo_logradouro')), printable(getField(establishment, 'logradouro'))]
      .filter(Boolean)
      .join(' '),
    printable(getField(establishment, 'numero')) && `nº ${printable(getField(establishment, 'numero'))}`,
    printable(getField(establishment, 'complemento')),
  ].filter(Boolean).join(', ')
  const cityLine = [
    printable(getDescription(establishment, 'municipio', 'city')),
    printable(getField(establishment, 'uf', 'state')),
  ].filter(Boolean).join(' / ')
  const address = [
    addressLine,
    printable(getField(establishment, 'bairro', 'district')),
    cityLine,
    printable(getField(establishment, 'cep', 'postalCode', 'postal_code'))
      ? `CEP ${String(getField(establishment, 'cep', 'postalCode', 'postal_code')).replace(/^(\d{5})(\d{3})$/, '$1-$2')}`
      : undefined,
  ].filter(Boolean).join(' · ')

  const phone = [
    ['ddd1', 'telefone1'],
    ['ddd2', 'telefone2'],
  ].map(([areaCodeKey, numberKey]) => {
    const number = printable(getField(establishment, numberKey))
    const areaCode = printable(getField(establishment, areaCodeKey))
    return number ? (areaCode ? `(${areaCode}) ${number}` : number) : undefined
  }).filter(Boolean).join(' / ')

  const sections = []
  addSection(sections, 'Dados da empresa', [
    { label: 'Razão social', value: getField(company, 'razao_social', 'legal_name', 'nome_empresarial') },
    { label: 'Nome fantasia', value: getField(establishment, 'nome_fantasia', 'trade_name') },
    { label: 'Natureza jurídica', value: getDescription(company, 'natureza_juridica', 'legal_nature') },
    { label: 'Porte', value: getDescription(company, 'porte_empresa', 'company_size', 'porte') },
    { label: 'Capital social', value: formatCurrency(getField(company, 'capital_social', 'share_capital')) },
    { label: 'Tipo de estabelecimento', value: getDescription(establishment, 'identificador_matriz_filial', 'establishment_type', 'branch_type') },
    { label: 'Data de abertura', value: formatDate(getField(establishment, 'data_inicio_atividade', 'opening_date', 'data_abertura')) },
  ])

  addSection(sections, 'Situação cadastral', [
    { label: 'Status', value: status },
    { label: 'Data da situação', value: formatDate(getField(establishment, 'data_situacao_cadastral', 'status_date')) },
    { label: 'Motivo', value: getDescription(establishment, 'motivo_situacao_cadastral', 'status_reason') },
    { label: 'Situação especial', value: printable(getField(establishment, 'situacao_especial', 'special_status')) },
    { label: 'Data da situação especial', value: formatDate(getField(establishment, 'data_situacao_especial', 'special_status_date')) },
  ])

  addSection(sections, 'Endereço', [
    { label: 'Localização', value: address },
  ])

  addSection(sections, 'Atividade econômica', [
    {
      label: 'Atividade principal',
      value: describeCnae(
        getDescription(establishment, 'cnae_fiscal_principal', 'primary_activity'),
        getField(establishment, 'cnae_fiscal_principal', 'primary_activity_code'),
      ),
    },
    { label: 'Atividades secundárias', value: activities },
  ])

  addSection(sections, 'Enquadramento empresarial', [
    { label: 'Optante pelo Simples Nacional', value: printable(getField(taxRegime, 'opcao_simples', 'simple_option')) },
    { label: 'Optante pelo MEI', value: printable(getField(taxRegime, 'opcao_mei', 'mei_option')) },
    { label: 'Total de sócios cadastrados', value: printable(getField(partners, 'total', 'count')) },
  ])

  addSection(sections, 'Contato', [
    { label: 'E-mail', value: getField(establishment, 'correio_eletronico', 'email') },
    { label: 'Telefone', value: phone },
    {
      label: 'Fax',
      value: [printable(getField(establishment, 'ddd_fax')), printable(getField(establishment, 'fax'))]
        .filter(Boolean)
        .join(' '),
    },
  ])

  addSection(sections, 'Referência dos dados', [
    { label: 'Competência da consulta', value: getField(metadata, 'competencia_receita', 'competence', 'competencia') },
    { label: 'Disponibilidade', value: getField(metadata, 'disponibilidade', 'availability') },
    { label: 'Atualização', value: formatDate(getField(metadata, 'fotografia', 'updated_at', 'atualizacao')) },
  ])

  return {
    companyName,
    cnpj: formatApiCnpj(registeredCnpj),
    status: printable(status),
    statusTone,
    sections,
  }
}
