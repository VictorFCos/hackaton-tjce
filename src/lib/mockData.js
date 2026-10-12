// Dados simulados realistas (fictícios) de uma vara do TJCE.
import { gerarCpf, gerarCnpj, cnjDV } from './validators';
import { TPU } from './rules';

export const VARA = 'Vara de Conflitos Fundiários e Desapropriações da Comarca de Fortaleza';
export const COMARCA = 'Fortaleza/CE';
const J = '8';
const TR = '06';
const ORIG = '0001';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let R = mulberry32(20261011);
const pick = (arr) => arr[Math.floor(R() * arr.length)];
const digits = (n) => Array.from({ length: n }, () => Math.floor(R() * 10)).join('');
const cpf = () => gerarCpf(digits(9));
const cnpj = () => gerarCnpj(digits(8) + '0001');
const cepCE = () => `60${String(100 + Math.floor(R() * 800)).padStart(3, '0')}-${digits(3)}`;
const clone = (x) => JSON.parse(JSON.stringify(x));

// ——— Analistas ———
export const ANALISTAS = [
  { id: 'a1', nome: 'Ana Beatriz Lima', cargo: 'Analista Judiciária', equipe: 'par', ativo: true, cor: '#007A3D', email: 'ana.lima@tjce.jus.br' },
  { id: 'a2', nome: 'Carlos Eduardo Rocha', cargo: 'Analista Judiciário', equipe: 'par', ativo: true, cor: '#059669', email: 'carlos.rocha@tjce.jus.br' },
  { id: 'a3', nome: 'Juliana Freitas', cargo: 'Analista Judiciária', equipe: 'impar', ativo: true, cor: '#10b981', email: 'juliana.freitas@tjce.jus.br' },
  { id: 'a4', nome: 'Rafael Monteiro', cargo: 'Técnico Judiciário', equipe: 'impar', ativo: true, cor: '#15803d', email: 'rafael.monteiro@tjce.jus.br' },
];

export const USUARIO = { nome: 'Paula Mendes', cargo: 'Diretora de Secretaria' };

// ——— Partes recorrentes ———
const ADVS = [
  { nome: 'Dr. Henrique Bastos', oab: 'OAB/CE 18.452' },
  { nome: 'Dra. Camila Torres', oab: 'OAB/CE 27.913' },
  { nome: 'Dr. Felipe Magalhães', oab: 'OAB/CE 9.871' },
  { nome: 'Dra. Renata Queiroz', oab: 'OAB/CE 33.120' },
  { nome: 'Defensoria Pública do Estado do Ceará', oab: 'OAB/CE 4.000' },
  { nome: 'Dr. Augusto Pinheiro', oab: 'OAB/PE 21.554' },
];

const DONA_MARIA = { nome: 'Maria das Graças Oliveira Souza', tipo: 'PF', doc: gerarCpf('123456789'), dataNascimento: '1951-03-14', cep: '60160-230' };
const JOSE = { nome: 'José Ferreira Lima', tipo: 'PF', doc: gerarCpf('987654321'), dataNascimento: '1998-07-22', cep: '60175-100' };
const BANCO_H = { nome: 'Banco Horizonte S.A.', tipo: 'PJ', doc: gerarCnpj('112223330001'), cep: '01310-100' };
const BANCO_S = { nome: 'Banco Sertão Crédito S.A.', tipo: 'PJ', doc: gerarCnpj('445556660001'), cep: '60165-121' };
const ENERGIA = { nome: 'Companhia Energética do Vale S.A.', tipo: 'PJ', doc: gerarCnpj('778889990001'), cep: '60150-160' };
const SAUDE = { nome: 'Operadora Saúde Mais Ltda.', tipo: 'PJ', doc: gerarCnpj('223334440001'), cep: '60115-170' };
const MP = { nome: 'Ministério Público do Estado do Ceará', tipo: 'PJ', doc: gerarCnpj('066227400001'), cep: '60811-341' };
const ESTADO = { nome: 'Estado do Ceará', tipo: 'PJ', doc: gerarCnpj('072656770001'), cep: '60170-900' };
const MUNICIPIO = { nome: 'Município de Fortaleza', tipo: 'PJ', doc: gerarCnpj('079546230001'), cep: '60060-390' };
const SOP = { nome: 'Superintendência de Obras Públicas - SOP/CE', tipo: 'PJ', doc: gerarCnpj('337810550001'), cep: '60822-325' };
const RIBEIRO = { nome: 'Comercial Ribeiro Ltda.', tipo: 'PJ', doc: gerarCnpj('334445550001'), cep: '60010-020' };

const pf = (nome, extra = {}) => ({ nome, tipo: 'PF', doc: cpf(), cep: cepCE(), ...extra });
const pj = (nome, extra = {}) => ({ nome, tipo: 'PJ', doc: cnpj(), cep: cepCE(), ...extra });
const comAdv = (parte, adv = pick(ADVS.slice(0, 4))) => ({ ...clone(parte), advogado: clone(adv) });

let uid = 0;
const novoId = () => `p${Date.now().toString(36)}${(++uid).toString(36)}`;

function numeroCNJ(ano, invalido = false, seq = String(200000 + Math.floor(R() * 799999)).padStart(7, '0')) {
  let dv = cnjDV(seq, ano, J, TR, ORIG);
  if (invalido) dv = String((Number(dv) + 41) % 100).padStart(2, '0');
  return `${seq}-${dv}.${ano}.${J}.${TR}.${ORIG}`;
}

function aplicarErros(p, erros = []) {
  const a = p.poloAtivo[0];
  for (const e of erros) {
    if (e === 'cpf') {
      const d = a.doc;
      a.doc = d.slice(0, -1) + ((Number(d.slice(-1)) + 3) % 10);
    }
    if (e === 'cpfAusente') a.doc = '';
    if (e === 'oab' && a.advogado) a.advogado.oab = 'CE 1874-5';
    if (e === 'assunto') p.assunto = 'Esbulho / Turbação / Ameaça';
    if (e === 'valor') p.valorCausa = 0;
    if (e === 'cep') a.cep = '6280-00';
    if (e === 'nasc') {
      a.pedePrioridadeIdoso = true;
      delete a.dataNascimento;
    }
    if (e === 'prisional') p.estabelecimentoPrisional = null;
    if (e === 'semAdv') delete a.advogado;
  }
  return p;
}

function processo(spec, now) {
  const ano = spec.ano ?? 2026;
  const autuadoEm = spec.data ? new Date(spec.data).toISOString() : new Date(now - (spec.horasAtras ?? 0) * 3600e3).toISOString();
  const p = {
    id: spec.id ?? novoId(),
    numero: numeroCNJ(ano, spec.erros?.includes('cnj')),
    classe: spec.classe,
    assunto: spec.assunto,
    vara: VARA,
    valorCausa: spec.valorCausa ?? 0,
    poloAtivo: clone(spec.ativo),
    poloPassivo: clone(spec.passivo),
    reuPreso: !!spec.reuPreso,
    estabelecimentoPrisional: spec.reuPreso ? spec.estabelecimento ?? 'Unidade Prisional de Triagem de Fortaleza (CPPL)' : null,
    tutelaUrgencia: !!spec.tutela,
    resumo: spec.resumo,
    autuadoEm,
    origem: spec.origem ?? 'fila',
    situacao: spec.situacao,
    resultado: spec.resultado,
    status: spec.status ?? 'triagem',
    statusDesde: spec.statusHorasAtras != null ? new Date(now - spec.statusHorasAtras * 3600e3).toISOString() : autuadoEm,
    concluidoEm: spec.concluidoHorasAtras != null ? new Date(now - spec.concluidoHorasAtras * 3600e3).toISOString() : null,
    analistaId: null,
    historicoEventos: [{ em: autuadoEm, texto: 'Processo autuado e capturado do PJe' }],
  };
  return aplicarErros(p, spec.erros);
}

// ——— Fila atual da vara ———
function specsFila() {
  return [
    {
      classe: 'Auto de Prisão em Flagrante', assunto: 'Esbulho Possessório Qualificado', reuPreso: true, horasAtras: 21, status: 'analise', statusHorasAtras: 4,
      ativo: [MP], passivo: [pf('Francisco Alves Pereira', { dataNascimento: '2001-02-11' })],
      resumo: 'Comunicação de prisão em flagrante de Francisco Alves Pereira pela suposta prática de esbulho possessório e dano ao patrimônio público em terreno do Estado no bairro Messejana em Fortaleza. Autoridade policial representa pela preventiva.',
    },
    {
      classe: 'Pedido de Liberdade Provisória', assunto: 'Liberdade Provisória', reuPreso: true, horasAtras: 9, status: 'triagem', erros: ['prisional'],
      ativo: [comAdv(pf('Antônio Marcos Silva', { dataNascimento: '1993-09-30' }), ADVS[4])], passivo: [MP],
      resumo: 'Requerente preso em flagrante por receptação (art. 180 do CP) pede liberdade provisória sem fiança. Alega trabalho lícito como pescador, filhos menores dependentes e ausência de antecedentes.',
    },
    {
      classe: 'Habeas Corpus Criminal', assunto: 'Prisão Preventiva', reuPreso: true, horasAtras: 26, status: 'minuta', statusHorasAtras: 3,
      ativo: [comAdv(pf('Luciano Barbosa Freire', { dataNascimento: '1987-12-05' }), ADVS[2])], passivo: [ESTADO],
      resumo: 'Impetração em favor de paciente preso preventivamente há 94 dias sem oferecimento de denúncia. Sustenta excesso de prazo e ausência de contemporaneidade dos fundamentos da custódia.',
    },
    {
      classe: 'Procedimento Comum Cível', assunto: 'Planos de Saúde', tutela: true, horasAtras: 14, status: 'triagem', valorCausa: 48000,
      ativo: [comAdv(pf('Raimunda Nonata Costa', { dataNascimento: '1942-06-18', pedePrioridadeIdoso: true }), ADVS[1])], passivo: [SAUDE],
      resumo: 'Autora de 84 anos, diagnosticada com insuficiência cardíaca, teve negada pela operadora a internação domiciliar (home care) prescrita pelo médico assistente. Requer tutela de urgência para custeio imediato do tratamento.',
    },
    {
      classe: 'Procedimento Comum Cível', assunto: 'Empréstimo consignado', horasAtras: 30, status: 'analise', statusHorasAtras: 6, valorCausa: 15800,
      ativo: [comAdv(pf('Francisca Helena Rodrigues', { dataNascimento: '1958-01-23', pedePrioridadeIdoso: true }), ADVS[0])], passivo: [BANCO_H],
      resumo: 'Aposentada do INSS alega descontos de empréstimo consignado que afirma nunca ter contratado. Pede declaração de inexistência do débito, repetição em dobro e danos morais.',
    },
    {
      classe: 'Procedimento Comum Cível', assunto: 'Fornecimento de Energia Elétrica', tutela: true, horasAtras: 40, status: 'triagem', valorCausa: 12000, erros: ['cep'],
      ativo: [comAdv(pf('Pedro Paulo Bezerra', { dataNascimento: '1962-04-02', pedePrioridadeIdoso: true }), ADVS[3])], passivo: [ENERGIA],
      resumo: 'Corte de energia em residência de idoso que utiliza concentrador de oxigênio, por débito em discussão administrativa. Pede religação imediata em tutela de urgência.',
    },
    {
      classe: 'Procedimento Comum Cível', assunto: 'Indenização por Dano Moral', tutela: true, horasAtras: 18, status: 'triagem', valorCausa: 20000, erros: ['nasc'],
      ativo: [comAdv(pf('Luiza Maria Santos'), ADVS[1])], passivo: [BANCO_S],
      resumo: 'Inclusão indevida do nome da autora em cadastro de inadimplentes por dívida já quitada. Pede exclusão liminar da negativação e indenização por danos morais. Pede prioridade de idosa.',
    },
    {
      classe: 'Mandado de Segurança Cível', assunto: 'Fornecimento de Medicamentos', tutela: true, horasAtras: 20, status: 'analise', statusHorasAtras: 2, valorCausa: 36500,
      ativo: [comAdv(pf('Cícero Romão Batista', { dataNascimento: '1979-08-15' }), ADVS[4])], passivo: [ESTADO],
      resumo: 'Impetrante portador de esclerose múltipla requer fornecimento do medicamento natalizumabe, negado pela Secretaria de Saúde por ausência de estoque. Laudo médico atesta risco de progressão irreversível.',
    },
    {
      classe: 'Reintegração / Manutenção de Posse', assunto: 'Esbulho / Turbação / Ameaça', tutela: true, horasAtras: 50, status: 'triagem', erros: ['valor'],
      ativo: [comAdv(pj('Agropecuária Jaguaribe Ltda.'), ADVS[2])], passivo: [pf('João Batista Nogueira')],
      resumo: 'Autora alega esbulho de área rural de 12 hectares na localidade de Cumbe, com derrubada de cerca há menos de ano e dia. Requer liminar de reintegração de posse.',
    },
    {
      classe: 'Procedimento Comum Cível', assunto: 'Indenização por Dano Moral', horasAtras: 5, status: 'triagem', valorCausa: 10000, erros: ['oab'],
      ativo: [comAdv(pf('Ana Cláudia Moreira', { dataNascimento: '1990-03-03' }))], passivo: [SAUDE],
      resumo: 'Negativa de cobertura de exame de ressonância magnética. Autora custeou o exame e pede reembolso e danos morais.',
    },
    {
      classe: 'Procedimento Comum Cível', assunto: 'Contratos Bancários', horasAtras: 12, status: 'triagem', valorCausa: 32700,
      ativo: [comAdv(pf('Marcos Vinícius Teixeira', { dataNascimento: '1985-11-19' }))], passivo: [BANCO_S],
      resumo: 'Revisional de contrato de financiamento de veículo com alegação de juros acima da média de mercado e venda casada de seguro.',
    },
    {
      classe: 'Execução de Título Extrajudicial', assunto: 'Cheque', horasAtras: 62, status: 'analise', valorCausa: 8400,
      ativo: [comAdv(RIBEIRO, ADVS[0])], passivo: [pf('Sebastião Gomes de Lima', { dataNascimento: '1975-05-05' })],
      resumo: 'Execução de três cheques devolvidos por insuficiência de fundos, emitidos para pagamento de material de construção.',
    },
    {
      classe: 'Reintegração / Manutenção de Posse', assunto: 'Esbulho / Turbação / Ameaça', tutela: true, horasAtras: 30, status: 'triagem', valorCausa: 150000,
      ativo: [comAdv(pj('Município de Fortaleza'), ADVS[4])], passivo: [pf('Associação dos Ocupantes da Gleba Mucuripe')],
      resumo: 'Ação de reintegração de posse de terreno público municipal destinado a equipamento de drenagem urbana e saúde. Pede liminar de desocupação.',
    },
    {
      classe: 'Procedimento Comum Cível', assunto: 'Usucapião Extraordinária', horasAtras: 3, status: 'triagem', valorCausa: 90000, erros: ['assunto'],
      ativo: [comAdv(pf('Joaquim Pereira Neto', { dataNascimento: '1968-02-27' }))], passivo: [pf('Espólio de Manoel Lima')],
      resumo: 'Usucapião de imóvel urbano ocupado há 22 anos de forma mansa e pacífica, com construção de residência familiar.',
    },
    {
      classe: 'Procedimento Comum Cível', assunto: 'Empréstimo consignado', horasAtras: 2, status: 'triagem', valorCausa: 9600, erros: ['cpf'],
      ativo: [comAdv(pf('Antônia Lúcia Freitas', { dataNascimento: '1970-09-09' }))], passivo: [BANCO_H],
      resumo: 'Descontos de cartão de crédito consignado (RMC) não solicitado em benefício previdenciário.',
    },
    {
      classe: 'Procedimento Comum Cível', assunto: 'Fornecimento de Energia Elétrica', horasAtras: 70, status: 'analise', statusHorasAtras: 66, valorCausa: 25000,
      ativo: [comAdv(pj('Restaurante Sabor do Mar Ltda.'), ADVS[3])], passivo: [ENERGIA],
      resumo: 'Cobrança de recuperação de consumo de R$ 18 mil após inspeção unilateral. Restaurante pede anulação do débito.',
    },
    {
      classe: 'Ação Penal - Procedimento Ordinário', assunto: 'Furto', horasAtras: 100, status: 'minuta', statusHorasAtras: 20,
      ativo: [MP], passivo: [pf('Wellington Souza Lima', { dataNascimento: '1999-01-17' })],
      resumo: 'Denúncia por furto qualificado de motocicleta. Réu solto, citado, com resposta à acusação apresentada pela Defensoria.',
    },
    {
      classe: 'Procedimento Comum Cível', assunto: 'Indenização por Dano Moral', horasAtras: 90, status: 'minuta', statusHorasAtras: 10, valorCausa: 15000,
      ativo: [comAdv(pf('Patrícia Gomes Araújo', { dataNascimento: '1988-06-21' }))], passivo: [pj('Loja Eletro Norte Ltda.')],
      resumo: 'Geladeira com defeito não reparada no prazo legal. Pede restituição do valor e danos morais.',
    },
    {
      classe: 'Procedimento Comum Cível', assunto: 'Empréstimo consignado', horasAtras: 1, status: 'triagem', valorCausa: 11200, erros: ['cpfAusente'],
      ativo: [comAdv(pf('Benedita Alves do Nascimento', { dataNascimento: '1966-12-12' }))], passivo: [BANCO_S],
      resumo: 'Refinanciamento de consignado sem autorização, com liberação de valor não solicitado em conta.',
    },
    // concluídos (para métricas de SLA)
    {
      classe: 'Procedimento Comum Cível', assunto: 'Planos de Saúde', horasAtras: 110, status: 'concluido', concluidoHorasAtras: 80, valorCausa: 22000,
      ativo: [comAdv(pf('Helena Martins Cruz', { dataNascimento: '1950-05-30' }))], passivo: [SAUDE],
      resumo: 'Reajuste por faixa etária abusivo em plano de saúde de idosa.',
    },
    {
      classe: 'Auto de Prisão em Flagrante', assunto: 'Violência Doméstica Contra a Mulher', reuPreso: true, horasAtras: 130, status: 'concluido', concluidoHorasAtras: 118,
      ativo: [MP], passivo: [pf('Roberto Carlos Menezes', { dataNascimento: '1984-03-08' })],
      resumo: 'Prisão em flagrante por descumprimento de medida protetiva. Audiência de custódia realizada.',
    },
    {
      classe: 'Desapropriação', assunto: 'Desapropriação por Utilidade Pública / Interesse Social', horasAtras: 120, status: 'concluido', concluidoHorasAtras: 30, valorCausa: 320000,
      ativo: [comAdv(ESTADO)], passivo: [pf('Espólio de Raimundo Nonato Aguiar')],
      resumo: 'Ação de desapropriação de faixa de terreno para implantação da Linha Leste do Metrô de Fortaleza (Metrofor). Acordo homologado em audiência.',
    },
    {
      classe: 'Procedimento Comum Cível', assunto: 'Contratos Bancários', horasAtras: 140, status: 'concluido', concluidoHorasAtras: 50, valorCausa: 41000,
      ativo: [comAdv(pf('Igor Rangel Pontes', { dataNascimento: '1979-04-04' }))], passivo: [BANCO_H],
      resumo: 'Revisional de contrato de capital de giro.',
    },
  ];
}

// ——— Acervo histórico (para o Dossiê) ———
function specsAcervo() {
  const arq = 'Arquivado definitivamente';
  const tram = 'Em tramitação';
  const autorH = () => [comAdv(pf(pick(['Raimundo Nonato Silva', 'Maria José Cavalcante', 'Expedito Barros', 'Terezinha de Jesus Lima', 'Valdemar Souza Neto', 'Rita de Cássia Paiva'])))];
  return [
    { data: '2019-04-11', classe: 'Procedimento Comum Cível', assunto: 'Empréstimo consignado', ativo: [comAdv(DONA_MARIA, ADVS[0])], passivo: [BANCO_H], situacao: arq, resultado: 'Sentença de procedência — restituição em dobro', valorCausa: 8200, resumo: 'Descontos não autorizados em benefício.' },
    { data: '2021-08-02', classe: 'Procedimento Comum Cível', assunto: 'Empréstimo consignado', ativo: [comAdv(DONA_MARIA, ADVS[0])], passivo: [BANCO_S], situacao: arq, resultado: 'Acordo homologado', valorCausa: 6400, resumo: 'Refinanciamento não solicitado.' },
    { data: '2022-03-17', classe: 'Execução de Título Extrajudicial', assunto: 'Cheque', ativo: [comAdv(RIBEIRO, ADVS[2])], passivo: [DONA_MARIA], situacao: arq, resultado: 'Extinta pelo pagamento', valorCausa: 1300, resumo: 'Cheque devolvido.' },
    { data: '2023-09-25', classe: 'Procedimento Comum Cível', assunto: 'Empréstimo consignado', ativo: [comAdv(DONA_MARIA, ADVS[0])], passivo: [BANCO_H], situacao: tram, resultado: 'Aguardando perícia grafotécnica', valorCausa: 12500, resumo: 'Novo contrato consignado contestado.' },
    { data: '2024-06-06', classe: 'Procedimento Comum Cível', assunto: 'Fornecimento de Energia Elétrica', ativo: [comAdv(DONA_MARIA, ADVS[3])], passivo: [ENERGIA], situacao: arq, resultado: 'Sentença de improcedência', valorCausa: 5000, resumo: 'Cobrança de consumo estimado.' },
    { data: '2025-02-19', classe: 'Procedimento Comum Cível', assunto: 'Planos de Saúde', ativo: [comAdv(DONA_MARIA, ADVS[1])], passivo: [SAUDE], situacao: tram, resultado: 'Fase de instrução', valorCausa: 30000, resumo: 'Negativa de cirurgia de catarata.' },
    { data: '2020-01-14', classe: 'Ação Penal - Procedimento Ordinário', assunto: 'Furto', ativo: [MP], passivo: [JOSE], situacao: arq, resultado: 'Condenação — pena cumprida', resumo: 'Furto simples de celular.' },
    { data: '2023-05-30', classe: 'Ação Penal - Procedimento Ordinário', assunto: 'Roubo', ativo: [MP], passivo: [JOSE], situacao: tram, resultado: 'Aguardando audiência de instrução', resumo: 'Roubo a transeunte.' },
    { data: '2024-11-08', classe: 'Auto de Prisão em Flagrante', assunto: 'Furto', ativo: [MP], passivo: [JOSE], situacao: arq, resultado: 'Liberdade provisória com cautelares', resumo: 'Flagrante por furto em comércio.' },
    { data: '2022-07-12', classe: 'Procedimento Comum Cível', assunto: 'Empréstimo consignado', ativo: autorH(), passivo: [BANCO_H], situacao: arq, resultado: 'Procedência', valorCausa: 7000, resumo: 'Consignado não contratado.' },
    { data: '2023-02-03', classe: 'Procedimento Comum Cível', assunto: 'Contratos Bancários', ativo: autorH(), passivo: [BANCO_H], situacao: tram, resultado: 'Concluso para sentença', valorCausa: 21000, resumo: 'Revisional.' },
    { data: '2024-03-21', classe: 'Procedimento Comum Cível', assunto: 'Empréstimo consignado', ativo: autorH(), passivo: [BANCO_H], situacao: arq, resultado: 'Acordo homologado', valorCausa: 9900, resumo: 'RMC.' },
    { data: '2025-05-09', classe: 'Procedimento Comum Cível', assunto: 'Empréstimo consignado', ativo: autorH(), passivo: [BANCO_H], situacao: tram, resultado: 'Prazo para contestação', valorCausa: 11000, resumo: 'Consignado com assinatura divergente.' },
  ].map((s) => ({ ...s, ano: Number(s.data.slice(0, 4)), origem: 'acervo', status: 'concluido' }));
}

// ——— Lote de ingestão (novos processos chegando do PJe) ———
function specsLote() {
  return [
    {
      classe: 'Auto de Prisão em Flagrante', assunto: 'Tráfico de Drogas e Condutas Afins', reuPreso: true, estabelecimento: 'Unidade Prisional de Triagem de Fortaleza (CPPL)',
      ativo: [MP], passivo: [JOSE],
      resumo: 'Comunicação de prisão em flagrante de José Ferreira Lima, abordado com 48 porções de substância análoga a cocaína e R$ 1.230,00 em espécie. Autoridade policial representa pela preventiva, citando reiteração delitiva. Custodiado aguarda audiência de custódia.',
    },
    {
      classe: 'Procedimento Comum Cível', assunto: 'Empréstimo consignado', tutela: true, valorCausa: 14300,
      ativo: [comAdv({ ...DONA_MARIA, pedePrioridadeIdoso: true }, ADVS[0])], passivo: [BANCO_H],
      resumo: 'Aposentada de 75 anos relata novos descontos de empréstimo consignado não contratado em seu benefício, reduzindo sua renda a menos de um salário mínimo. Pede suspensão liminar dos descontos, declaração de inexistência do débito e danos morais.',
    },
    {
      classe: 'Procedimento Comum Cível', assunto: 'Indenização por Dano Moral', erros: ['cpf', 'oab', 'cep', 'valor'],
      ativo: [comAdv(pf('Rodrigo Almeida Castro', { dataNascimento: '1992-10-10' }))], passivo: [pj('Construtora Litoral Leste Ltda.')],
      resumo: 'Atraso de 26 meses na entrega de unidade habitacional adquirida na planta. Pede lucros cessantes e danos morais.',
    },
    {
      classe: 'Desapropriação', assunto: 'Imissão Provisória na Posse', valorCausa: 420000,
      ativo: [comAdv(pj('Município de Fortaleza'), ADVS[4])], passivo: [pj('Imobiliária e Agropecuária Meireles S/A')],
      resumo: 'Ação de desapropriação de terreno de 4.000m² para utilidade pública visando implantação de contenção de encosta e equipamento municipal no Bairro Papicu.',
    },
    {
      classe: 'Mandado de Segurança Cível', assunto: 'Concurso Público / Edital', tutela: true, valorCausa: 1000,
      ativo: [comAdv(pf('Beatriz Nogueira Sampaio', { dataNascimento: '1997-12-01' }), ADVS[5])], passivo: [pj('Município de Fortaleza')],
      resumo: 'Candidata eliminada de concurso municipal por suposta ausência de documento entregue tempestivamente. Pede liminar para participar da próxima etapa marcada para 5 dias.',
    },
    {
      classe: 'Procedimento Comum Cível', assunto: 'Fornecimento de Energia Elétrica', valorCausa: 8000,
      ativo: [comAdv(pf('Severino Ramos da Silva', { dataNascimento: '1940-01-20', pedePrioridadeIdoso: true }), ADVS[3])], passivo: [ENERGIA],
      resumo: 'Idoso de 86 anos com faturas triplicadas após troca de medidor. Pede revisão das faturas e vedação de corte.',
    },
    {
      classe: 'Procedimento Comum Cível', assunto: 'Contratos Bancários', valorCausa: 27400, erros: ['cnj'],
      ativo: [comAdv(pf('Gustavo Henrique Prado', { dataNascimento: '1981-07-07' }))], passivo: [BANCO_H],
      resumo: 'Revisional de cédula de crédito bancário com capitalização diária de juros não pactuada.',
    },
  ];
}

const NOMES = ['Aline Castro', 'Bruno Sales', 'Cláudia Ramos', 'Daniel Fontenele', 'Elaine Mota', 'Fernando Arruda', 'Gabriela Pinto', 'Heitor Viana', 'Isabela Rocha', 'Jonas Cavalcante', 'Karla Menezes', 'Leonardo Brito'];

function specAleatoria() {
  const civis = Object.keys(TPU).filter((c) => !['Auto de Prisão em Flagrante', 'Pedido de Liberdade Provisória', 'Habeas Corpus Criminal', 'Ação Penal - Procedimento Ordinário'].includes(c));
  const preso = R() < 0.15;
  if (preso) {
    return { classe: 'Auto de Prisão em Flagrante', assunto: pick(TPU['Auto de Prisão em Flagrante']), reuPreso: true, ativo: [MP], passivo: [pf(pick(NOMES), { dataNascimento: `199${Math.floor(R() * 9)}-05-10` })], resumo: 'Comunicação de prisão em flagrante encaminhada pelo 15º Distrito Policial de Fortaleza. Pendente análise da conversão em preventiva.' };
  }
  const classe = pick(civis);
  const idoso = R() < 0.2;
  const erros = R() < 0.35 ? [pick(['cpf', 'oab', 'cep', 'valor', 'cpfAusente'])] : [];
  return {
    classe, assunto: pick(TPU[classe]), tutela: R() < 0.25, valorCausa: Math.round(3000 + R() * 40000), erros,
    ativo: [comAdv(pf(pick(NOMES), { dataNascimento: idoso ? `195${Math.floor(R() * 9)}-03-03` : `198${Math.floor(R() * 9)}-03-03`, pedePrioridadeIdoso: idoso }))],
    passivo: [pick([BANCO_H, BANCO_S, ENERGIA, SAUDE, ESTADO])],
    resumo: 'Petição inicial recebida eletronicamente via PJe. Pedido descrito na inicial aguardando triagem.',
  };
}

export function gerarEstadoBase(now = Date.now()) {
  R = mulberry32(20261011);
  const fila = specsFila().map((s) => processo(s, now));
  const acervo = specsAcervo().map((s) => processo(s, now));
  return { fila, acervo };
}

/** Próximo lote vindo do PJe. O primeiro é roteirizado para a demo; os seguintes são aleatórios. */
export function proximoLote(indice, now = Date.now()) {
  const specs = indice === 0 ? specsLote() : Array.from({ length: 3 + Math.floor(R() * 3) }, specAleatoria);
  return specs.map((s, i) => processo({ ...s, horasAtras: (specs.length - i) * 0.02 }, now));
}

export function exemploLoteJSON() {
  const now = Date.now();
  return specsLote().slice(1, 3).map((s) => {
    const p = processo(s, now);
    return { numero: p.numero, classe: p.classe, assunto: p.assunto, valorCausa: p.valorCausa, tutelaUrgencia: p.tutelaUrgencia, reuPreso: p.reuPreso, poloAtivo: p.poloAtivo, poloPassivo: p.poloPassivo, resumo: p.resumo };
  });
}
