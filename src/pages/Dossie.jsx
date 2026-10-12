import { useState, useEffect } from 'react';
import {
  UserSearch, Search, AlertTriangle, ShieldCheck, Building2, User, FileText,
  ChevronRight, History, ArrowUpRight, FolderArchive, Scale, Shield, Files, CheckCircle2,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { NumeroProc, SlaBadge } from '../components/ui';
import { buscarPartes, montarDossie } from '../lib/rules';
import { fmtMoeda, fmtData } from '../lib/format';

export default function Dossie() {
  const { todos, dossieAlvo, setDossieAlvo, abrirProcesso } = useStore();
  const [termo, setTermo] = useState(dossieAlvo || 'Maria das Graças');
  const sugestoes = termo ? buscarPartes(termo, todos) : [];
  const [chaveSelecionada, setChaveSelecionada] = useState(dossieAlvo || '');

  useEffect(() => {
    if (dossieAlvo) {
      setTermo(dossieAlvo);
      setChaveSelecionada(dossieAlvo);
    } else if (!chaveSelecionada && sugestoes.length > 0) {
      setChaveSelecionada(sugestoes[0].chave);
    }
  }, [dossieAlvo, sugestoes.length]);

  const dossie = chaveSelecionada ? montarDossie(chaveSelecionada, todos) : null;

  const parteSelecionada = sugestoes.find((s) => s.chave === chaveSelecionada) ||
    (dossie?.lista[0] ? (
      dossie.lista[0].poloAtivo.find((x) => (x.doc?.replace(/\D/g, '') || x.nome.toLowerCase()) === chaveSelecionada) ||
      dossie.lista[0].poloPassivo.find((x) => (x.doc?.replace(/\D/g, '') || x.nome.toLowerCase()) === chaveSelecionada)
    ) : null);

  return (
    <div className="page-content">
      {/* Cabeçalho da Página */}
      <div className="page-header-row">
        <div>
          <h2>Consulta & Dossiê Unificado de Partes</h2>
          <p className="subtext">
            Histórico integrado por CPF/CNPJ e verificação de prevenção processual (arts. 55 e 286 do CPC).
          </p>
        </div>
      </div>

      {/* Caixa de Busca com Filtros Rápidos */}
      <div className="search-section">
        <label className="text-muted small mb-2 d-block" style={{ fontWeight: '600' }}>
          Consultar por CPF, CNPJ ou Nome da Parte:
        </label>
        <div className="search-input-group">
          <Search size={18} color="var(--pje-blue)" />
          <input
            type="text"
            className="search-input"
            placeholder="Digite CPF, CNPJ ou nome da parte..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
        </div>

        {sugestoes.length > 0 && (
          <div className="mt-3">
            <span className="small text-muted d-block mb-2" style={{ fontWeight: '600' }}>
              Partes sugeridas na base:
            </span>
            <div className="chips-list">
              {sugestoes.slice(0, 6).map((s, idx) => (
                <button
                  key={idx}
                  className={`chip-btn ${chaveSelecionada === s.chave ? 'active' : ''}`}
                  onClick={() => {
                    setChaveSelecionada(s.chave);
                    setDossieAlvo(s.chave);
                  }}
                >
                  {s.tipo === 'PJ' ? <Building2 size={13} /> : <User size={13} />}
                  <span>{s.nome}</span>
                  <span className="badge-count">{s.total} feitos</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resultados do Dossiê */}
      {dossie && (
        <div className="dossie-results">
          {/* Card de Identificação da Parte Consultada */}
          <div className="dossie-perfil-card">
            <div className="dpc-avatar">
              {parteSelecionada?.tipo === 'PJ' ? <Building2 size={24} /> : <User size={24} />}
            </div>
            <div className="dpc-info">
              <div className="dpc-top">
                <h3>{parteSelecionada?.nome || termo}</h3>
                <span className="dpc-tipo-badge">
                  {parteSelecionada?.tipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                </span>
                {dossie.alertas.length > 0 && (
                  <span className="pill pill-warn" style={{ fontSize: '11px' }}>
                    <AlertTriangle size={12} /> Possível Prevenção no Acervo (art. 55 CPC)
                  </span>
                )}
              </div>
              <div className="dpc-meta">
                <span>{parteSelecionada?.tipo === 'PJ' ? 'CNPJ' : 'CPF'}: <strong>{parteSelecionada?.doc || '123.456.789-09'}</strong></span>
                <span>•</span>
                <span>Registro Unificado no TJCE: <strong>{dossie.lista.length} feitos vinculados</strong></span>
                <span>•</span>
                <span>Comarca: <strong>Fortaleza / CE</strong></span>
              </div>
            </div>
          </div>

          {/* Grade de Indicadores Executivos (KPIs com Espaçamento e Respiro) */}
          <div className="dossie-kpi-grid">
            <div className="dkpi-card">
              <div className="dkpi-header">
                <span className="dkpi-label">Total de Processos</span>
                <span className="dkpi-icon blue"><FolderArchive size={16} /></span>
              </div>
              <div className="dkpi-val">{dossie.lista.length}</div>
              <span className="dkpi-sub">Feitos no acervo</span>
            </div>

            <div className="dkpi-card">
              <div className="dkpi-header">
                <span className="dkpi-label">Polo Ativo (Autora)</span>
                <span className="dkpi-icon green"><Scale size={16} /></span>
              </div>
              <div className="dkpi-val green">{dossie.lista.filter((x) => x.papel === 'Autor(a)').length}</div>
              <span className="dkpi-sub">Ações ajuizadas</span>
            </div>

            <div className="dkpi-card">
              <div className="dkpi-header">
                <span className="dkpi-label">Polo Passivo (Ré)</span>
                <span className="dkpi-icon red"><Shield size={16} /></span>
              </div>
              <div className="dkpi-val red">{dossie.lista.filter((x) => x.papel !== 'Autor(a)').length}</div>
              <span className="dkpi-sub">Demandas respondidas</span>
            </div>

            <div className="dkpi-card">
              <div className="dkpi-header">
                <span className="dkpi-label">Matérias Distintas</span>
                <span className="dkpi-icon gold"><Files size={16} /></span>
              </div>
              <div className="dkpi-val gold">{Object.keys(dossie.grupos).length}</div>
              <span className="dkpi-sub">Assuntos da TPU</span>
            </div>

            <div className="dkpi-card">
              <div className="dkpi-header">
                <span className="dkpi-label">Prevenção / Conexão</span>
                <span className={`dkpi-icon ${dossie.alertas.length > 0 ? 'amber' : 'green'}`}>
                  {dossie.alertas.length > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                </span>
              </div>
              <div className={`dkpi-val ${dossie.alertas.length > 0 ? 'amber' : 'green'}`}>
                {dossie.alertas.length > 0 ? `${dossie.alertas.length} matéria(s)` : 'Regular'}
              </div>
              <span className="dkpi-sub">Arts. 55 e 286 CPC</span>
            </div>
          </div>

          {/* Cabeçalho da Seção de Processos */}
          <div className="dossie-section-title">
            <div>
              <h3>Histórico Processual por Assunto</h3>
              <p className="subtext" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                {dossie.lista.length} processo(s) organizados em {Object.keys(dossie.grupos).length} matéria(s) processual(is)
              </p>
            </div>
          </div>

          {/* Processos Agrupados por Matéria */}
          <div className="historico-grupos">
            {Object.entries(dossie.grupos).map(([assunto, processosDoGrupo]) => {
              const temMultiplas = processosDoGrupo.length > 1;

              return (
                <div key={assunto} className="card mb-4">
                  <div className="card-h" style={{ background: temMultiplas ? 'rgba(217, 119, 6, 0.06)' : 'var(--bg-card-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={16} color={temMultiplas ? 'var(--warning)' : 'var(--pje-blue)'} />
                      <strong style={{ fontSize: '13.5px' }}>{assunto}</strong>
                      <span className="pill pill-info" style={{ fontSize: '10.5px' }}>
                        {processosDoGrupo.length} processo(s)
                      </span>
                    </div>
                    {temMultiplas && (
                      <span className="pill pill-warn" style={{ fontSize: '11px' }}>
                        Conexão / Repetição
                      </span>
                    )}
                  </div>

                  <div className="table-responsive" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="pje-table">
                      <thead>
                        <tr>
                          <th>Processo</th>
                          <th>Posição</th>
                          <th>Contraparte</th>
                          <th>Situação</th>
                          <th>Valor</th>
                          <th>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processosDoGrupo.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <NumeroProc numero={p.numero} destacar />
                              <div className="text-muted small">{fmtData(p.autuadoEm)}</div>
                            </td>
                            <td>
                              <span className={`badge-papel ${p.papel === 'Autor(a)' ? 'autor' : 'reu'}`}>
                                {p.papel}
                              </span>
                            </td>
                            <td>
                              <strong style={{ color: 'var(--text-main)' }}>
                                {p.papel === 'Autor(a)'
                                  ? p.poloPassivo.map((x) => x.nome).join(', ')
                                  : p.poloAtivo.map((x) => x.nome).join(', ')}
                              </strong>
                            </td>
                            <td>
                              <span className="pill pill-info">
                                {p.situacao || (p.status === 'concluido' ? 'Arquivado' : 'Em Tramitação')}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontWeight: '600' }}>{fmtMoeda(p.valorCausa)}</span>
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={() => abrirProcesso(p.id)}
                              >
                                Abrir <ArrowUpRight size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
