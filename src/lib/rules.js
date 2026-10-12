import { cnjValido, cpfValido, cnpjValido, oabValida, cepValido, idade, onlyDigits } from './validators';

// Tabela Processual Unificada (recorte) — classe → assuntos compatíveis (Vara Fundiária / Desapropriações / Posse Pública)
export const TPU = {
  'Reintegração / Manutenção de Posse': ['Esbulho / Turbação / Ameaça', 'Posse de Bem Público', 'Ocupação Irregular de Área Pública', 'Proteção Possessória'],
  'Desapropriação': ['Desapropriação por Utilidade Pública', 'Desapropriação Indireta', 'Imissão Provisória na Posse'],
  'Procedimento Comum Cível': ['Usucapião Extraordinária', 'Demarcação / Divisão de Terras', 'Regularização Fundiária Urbana (Reurb)', 'Indenização por Ocupação Indevida', 'Empréstimo consignado', 'Planos de Saúde'],
  'Interdito Proibitório': ['Ameaça à Posse Pública', 'Área de Preservação Permanente'],
  'Ação Demarcatória / Divisória': ['Fixação de Rumos e Limites', 'Terras Devolutas'],
  'Embargos de Terceiro': ['Constrição Judicial em Imóvel', 'Posse de Terceiro'],
  'Mandado de Segurança Cível': ['Ato de Imissão na Posse', 'Alvará de Construção / Obras Públicas', 'Concurso Público / Edital'],
  'Auto de Prisão em Flagrante': ['Esbulho Possessório Qualificado', 'Dano ao Patrimônio Público', 'Crime Ambiental / Ocupação', 'Violência Doméstica Contra a Mulher', 'Roubo'],
  'Pedido de Liberdade Provisória': ['Prisão em flagrante', 'Liberdade Provisória'],
  'Habeas Corpus Criminal': ['Prisão Preventiva', 'Liberdade Provisória'],
  'Ação Penal - Procedimento Ordinário': ['Dano ao Patrimônio Público', 'Esbulho Possessório', 'Furto'],
};

export const CLASSES_CRIMINAIS = ['Auto de Prisão em Flagrante', 'Pedido de Liberdade Provisória', 'Habeas Corpus Criminal', 'Ação Penal - Procedimento Ordinário'];
const DISPENSA_ADVOGADO = ['Habeas Corpus Criminal', 'Auto de Prisão em Flagrante', 'Ação Penal - Procedimento Ordinário'];
const EXIGE_VALOR = (c) => !CLASSES_CRIMINAIS.includes(c);

export const STATUS = [
  { id: 'triagem', label: 'A analisar', cor: 'var(--pje-600)' },
  { id: 'analise', label: 'Em análise', cor: 'var(--violet)' },
  { id: 'minuta', label: 'Minuta / Assinatura', cor: 'var(--gold)' },
  { id: 'concluido', label: 'Concluído', cor: 'var(--success)' },
];

export const DEFAULT_CONFIG = {
  modo: 'par_impar', // 'par_impar' | 'round_robin'
  digito: 'sequencial', // último dígito do nº sequencial (NNNNNNN)
  sla: { reuPreso: 24, idoso80: 24, idoso: 48, tutela: 72 },
  canais: { teams: true, email: true, push: true },
};

/** Validação de cadastro → lista de pendências com caminho do campo (para destaque amarelo). */
export function validarProcesso(p) {
  const e = [];
  const add = (path, msg, campo) => e.push({ path, msg, campo });

  if (!cnjValido(p.numero)) add('numero', 'Dígito verificador do número CNJ não confere (Res. CNJ 65/2008)', 'Número do processo');

  const assuntos = TPU[p.classe];
  if (assuntos && !assuntos.includes(p.assunto)) add('assunto', `Assunto "${p.assunto}" incompatível com a classe "${p.classe}" (TPU/CNJ)`, 'Assunto');

  if (EXIGE_VALOR(p.classe) && !(Number(p.valorCausa) > 0)) add('valorCausa', 'Valor da causa não informado (art. 291 do CPC)', 'Valor da causa');

  if (p.reuPreso && !p.estabelecimentoPrisional) add('estabelecimentoPrisional', 'Réu preso sem unidade prisional informada', 'Unidade prisional');

  const polos = [['poloAtivo', 'Polo ativo'], ['poloPassivo', 'Polo passivo']];
  for (const [polo, rotulo] of polos) {
    (p[polo] || []).forEach((parte, i) => {
      const base = `${polo}.${i}`;
      const doc = onlyDigits(parte.doc);
      if (!doc) add(`${base}.doc`, `${rotulo}: ${parte.nome} sem CPF/CNPJ informado`, 'CPF/CNPJ');
      else if (parte.tipo === 'PJ' ? !cnpjValido(doc) : !cpfValido(doc))
        add(`${base}.doc`, `${rotulo}: ${parte.tipo === 'PJ' ? 'CNPJ' : 'CPF'} de ${parte.nome} inválido (dígito verificador)`, 'CPF/CNPJ');

      if (parte.cep !== undefined && !cepValido(parte.cep)) add(`${base}.cep`, `${rotulo}: CEP de ${parte.nome} inválido`, 'CEP');

      if (parte.pedePrioridadeIdoso) {
        const id = idade(parte.dataNascimento);
        if (id === null) add(`${base}.dataNascimento`, `Prioridade de idoso pedida para ${parte.nome}, mas sem data de nascimento`, 'Data de nascimento');
        else if (id < 60) add(`${base}.dataNascimento`, `Prioridade de idoso pedida, mas ${parte.nome} tem ${id} anos`, 'Data de nascimento');
      }

      if (polo === 'poloAtivo') {
        if (parte.advogado) {
          if (!oabValida(parte.advogado.oab)) add(`${base}.advogado.oab`, `OAB do(a) advogado(a) ${parte.advogado.nome} inválida ou fora do padrão "OAB/UF 00.000"`, 'OAB');
        } else if (!DISPENSA_ADVOGADO.includes(p.classe)) {
          add(`${base}.advogado`, `${parte.nome} sem advogado(a) constituído(a)`, 'Advogado');
        }
      }
    });
  }
  return e;
}

export function maiorIdade(p) {
  const todas = [...(p.poloAtivo || []), ...(CLASSES_CRIMINAIS.includes(p.classe) ? p.poloPassivo || [] : [])]
    .filter((x) => x.tipo !== 'PJ')
    .map((x) => idade(x.dataNascimento))
    .filter((x) => x !== null);
  return todas.length ? Math.max(...todas) : null;
}

/** Motor de SLA: Réu Preso → Idoso 80+ → Idoso 60+ → Tutela de urgência. */
export function calcularUrgencia(p, config = DEFAULT_CONFIG) {
  const sla = config.sla;
  const id = maiorIdade(p);
  let u = null;
  if (p.reuPreso) u = { tipo: 'REU_PRESO', label: 'Réu Preso', horas: sla.reuPreso, nivel: 'critico' };
  else if (id !== null && id >= 80) u = { tipo: 'IDOSO_80', label: 'Idoso 80+', horas: sla.idoso80, nivel: 'critico' };
  else if (id !== null && id >= 60) u = { tipo: 'IDOSO', label: `Idoso · ${id} anos`, horas: sla.idoso, nivel: 'alto' };
  else if (p.tutelaUrgencia) u = { tipo: 'TUTELA', label: 'Tutela de Urgência', horas: sla.tutela, nivel: 'medio' };
  if (!u) return null;
  const inicio = new Date(p.autuadoEm).getTime();
  return { ...u, inicio, prazo: inicio + u.horas * 3600e3, tutela: !!p.tutelaUrgencia };
}

export function enriquecer(p, config) {
  const pendencias = p.cadastroCorrigido ? [] : validarProcesso(p);
  return { ...p, pendencias, urgencia: calcularUrgencia(p, config) };
}

export const ultimoDigito = (numero) => Number(String(numero).slice(6, 7));
export const equipeDoNumero = (numero) => (ultimoDigito(numero) % 2 === 0 ? 'par' : 'impar');

/** Distribuição Par/Ímpar (com balanceamento interno) ou Round-Robin balanceado. */
export function escolherAnalista(numero, analistas, processos, config) {
  const ativos = analistas.filter((a) => a.ativo);
  if (!ativos.length) return null;
  let pool = ativos;
  if (config.modo === 'par_impar') {
    const eq = equipeDoNumero(numero);
    const doTime = ativos.filter((a) => a.equipe === eq);
    if (doTime.length) pool = doTime;
  }
  const carga = (a) => processos.filter((p) => p.analistaId === a.id && p.status !== 'concluido').length;
  return [...pool].sort((a, b) => carga(a) - carga(b) || a.id.localeCompare(b.id))[0];
}

// ——— Dossiê "Dona Maria" ———

const docsDe = (p) => [...(p.poloAtivo || []), ...(p.poloPassivo || [])];

export function buscarPartes(termo, todos) {
  const t = termo.trim().toLowerCase();
  const dig = onlyDigits(termo);
  if (t.length < 3) return [];
  const mapa = new Map();
  for (const p of todos) {
    for (const parte of docsDe(p)) {
      const d = onlyDigits(parte.doc);
      const casa = (dig.length >= 3 && d.includes(dig)) || parte.nome.toLowerCase().includes(t);
      if (!casa) continue;
      const chave = d || parte.nome.toLowerCase();
      if (!mapa.has(chave)) mapa.set(chave, { ...parte, chave, total: 0 });
      mapa.get(chave).total++;
    }
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total).slice(0, 8);
}

const mesmaParte = (a, chave) => (onlyDigits(a.doc) || a.nome.toLowerCase()) === chave;

export function montarDossie(chave, todos) {
  const lista = [];
  for (const p of todos) {
    const ativo = (p.poloAtivo || []).some((x) => mesmaParte(x, chave));
    const passivo = (p.poloPassivo || []).some((x) => mesmaParte(x, chave));
    if (ativo || passivo) lista.push({ ...p, papel: ativo ? 'Autor(a)' : 'Réu/Ré' });
  }
  lista.sort((a, b) => new Date(b.autuadoEm) - new Date(a.autuadoEm));
  const grupos = {};
  for (const p of lista) (grupos[p.assunto] ||= []).push(p);
  const alertas = [];
  for (const [assunto, ps] of Object.entries(grupos)) {
    if (ps.length < 2) continue;
    const emCurso = ps.filter((x) => x.origem === 'fila' || x.situacao === 'Em tramitação');
    const contrapartes = ps.map((x) => (x.papel === 'Autor(a)' ? x.poloPassivo : x.poloAtivo).map((c) => c.nome).join(', '));
    const repetida = contrapartes.find((c, i) => contrapartes.indexOf(c) !== i);
    alertas.push({
      assunto,
      qtd: ps.length,
      forte: Boolean(repetida) && emCurso.length >= 1,
      contraparte: repetida,
      texto: repetida
        ? `${ps.length} ações sobre "${assunto}" contra ${repetida}. Verificar prevenção/conexão (arts. 55 e 286 do CPC).`
        : `${ps.length} ações sobre "${assunto}". Possível litigância repetitiva ou conexão.`,
    });
  }
  return { lista, grupos, alertas };
}

/** Resumo histórico enxuto de cada parte (para o painel do processo e para a IA). */
export function historicoDasPartes(p, todos) {
  return docsDe(p).map((parte) => {
    const chave = onlyDigits(parte.doc) || parte.nome.toLowerCase();
    const outros = todos.filter((x) => x.id !== p.id && docsDe(x).some((y) => mesmaParte(y, chave)));
    const mesmoAssunto = outros.filter((x) => x.assunto === p.assunto).length;
    return { nome: parte.nome, chave, tipo: parte.tipo, anteriores: outros.length, mesmoAssunto };
  });
}
