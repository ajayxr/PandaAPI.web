import assert from 'node:assert/strict'
import test from 'node:test'
import { findApiDocument, findApiValidation, formatLookupResult } from '../src/api-formatters.js'

test('reconhece o resultado de validação enviado pela PandaAPI', () => {
  assert.equal(findApiValidation({ message: 'CPF válido.', cpf: '52998224725' }), true)
  assert.equal(findApiValidation({ message: 'CNPJ válido.', cnpj: '00000000000191' }), true)
  assert.equal(findApiValidation({ message: 'CPF inválido.', cpf: '11111111111' }), false)
  assert.equal(findApiValidation({ detail: 'Documento não é válido.' }), false)
  assert.equal(findApiValidation({ message: 'Consulta processada.' }), null)
  assert.equal(findApiValidation({ valid: false, message: 'Consulta processada.' }), false)
})

test('extrai os documentos dos objetos de geração reais da PandaAPI', () => {
  assert.equal(findApiDocument({ cpf: '52998224725' }, 11), '52998224725')
  assert.equal(findApiDocument({ result: { cnpj: 'AB123456000178' } }, 14), 'AB123456000178')
})

test('organiza os campos cadastrais, as descrições e o endereço para o cliente', () => {
  const result = formatLookupResult({
    dados: {
      empresa: {
        razao_social: 'Empresa de exemplo S.A.',
        natureza_juridica: '2046',
        porte_empresa: '05',
        capital_social: 2500000,
        descricoes: {
          natureza_juridica: 'Sociedade Anônima Aberta',
          porte_empresa: 'Demais',
        },
        socios: {
          total: 3,
          itens: [{ nome: 'Nome privado', cpf: '11111111111' }],
        },
        simples: { opcao_simples: false, opcao_mei: false },
      },
      estabelecimento: {
        cnpj: '00000000000191',
        nome_fantasia: 'Empresa Exemplo',
        identificador_matriz_filial: '1',
        situacao_cadastral: '02',
        data_situacao_cadastral: '2024-05-06',
        data_inicio_atividade: '2000-04-03',
        cnae_fiscal_principal: '6410700',
        tipo_logradouro: 'AVENIDA',
        logradouro: 'PAULISTA',
        numero: '1000',
        complemento: 'CJ 10',
        bairro: 'BELA VISTA',
        cep: '01310100',
        uf: 'SP',
        municipio: '7107',
        ddd1: '11',
        telefone1: '23456789',
        correio_eletronico: 'contato@example.com',
        descricoes: {
          identificador_matriz_filial: 'Matriz',
          situacao_cadastral: 'Ativa',
          municipio: 'São Paulo',
          cnae_fiscal_principal: 'Bancos múltiplos, com carteira comercial',
          'cnae_secundaria:6499999': 'Outras atividades de serviços financeiros',
        },
      },
    },
    meta: { competencia_receita: '2026-01' },
  }, '00000000000191')

  assert.equal(result.cnpj, '00.000.000/0001-91')
  assert.equal(result.companyName, 'Empresa de exemplo S.A.')
  assert.equal(result.status, 'Ativa')
  assert.equal(result.statusTone, 'positive')
  assert.deepEqual(result.sections.map(({ title }) => title), [
    'Dados da empresa',
    'Situação cadastral',
    'Endereço',
    'Atividade econômica',
    'Enquadramento empresarial',
    'Contato',
    'Referência dos dados',
  ])

  const fields = result.sections.flatMap((section) => section.fields)
  const formattedCapital = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(2500000)
  assert.ok(fields.some(({ label, value }) => label === 'Capital social' && value === formattedCapital))
  assert.ok(fields.some(({ label, value }) => label === 'Data de abertura' && value === '03/04/2000'))
  assert.ok(fields.some(({ label, value }) => label === 'Localização' && value.includes('AVENIDA PAULISTA, nº 1000')))
  assert.ok(fields.some(({ label, value }) => label === 'Atividade principal' && value.includes('CNAE 6410-7/00')))
  assert.ok(fields.some(({ label, value }) => label === 'Optante pelo Simples Nacional' && value === 'Não'))
  assert.ok(fields.some(({ label, value }) => label === 'Total de sócios cadastrados' && value === '3'))
  assert.ok(!JSON.stringify(result).includes('Nome privado'))
  assert.ok(!JSON.stringify(result).includes('11111111111'))
})

test('aceita respostas com campos vazios e CNPJ alfanumérico', () => {
  const result = formatLookupResult({
    dados: {
      empresa: { razao_social: null, capital_social: null },
      estabelecimento: {
        cnpj: 'AB123456000178',
        situacao_cadastral: null,
        descricoes: { situacao_cadastral: 'Em atividade' },
      },
    },
  }, 'AB123456000178')

  assert.equal(result.cnpj, 'AB.123.456/0001-78')
  assert.equal(result.companyName, 'Dados da empresa')
  assert.equal(result.status, 'Em atividade')
  assert.equal(result.statusTone, 'positive')
  assert.deepEqual(result.sections, [
    { title: 'Situação cadastral', fields: [{ label: 'Status', value: 'Em atividade' }] },
  ])
})
