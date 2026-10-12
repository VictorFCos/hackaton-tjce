import { useState } from 'react';
import { Columns3, List, Users, CheckCircle, ArrowRight, ArrowLeft, Shuffle, Sparkles, Filter, Split, GripVertical, Siren, AlertTriangle } from 'lucide-react';
import { useStore, useNow } from '../lib/store';
import { Avatar, estadoSla, EquipeTag, NumeroProc, SlaBadge } from '../components/ui';
import { STATUS, equipeDoNumero, ultimoDigito } from '../lib/rules';
import { fmtDataHora, fmtMoeda, fmtRestante } from '../lib/format';

export default function Fila() {
  const { processos, abrirProcesso, dispatch, analistaPorId, state, toast } = useStore();
  const now = useNow(1000);
  const [visao, setVisao] = useState('kanban'); // 'kanban' | 'split' | 'tabela'
  const [filtroEquipe, setFiltroEquipe] = useState('todas'); // 'todas' | 'par' | 'impar'
  const [arrastandoId, setArrastandoId] = useState(null);
  const [colunaHover, setColunaHover] = useState(null);

  const processosFiltrados = processos.filter((p) => {
    if (filtroEquipe === 'todas') return true;
    return equipeDoNumero(p.numero) === filtroEquipe;
  });

  const processosPar = processos.filter((p) => equipeDoNumero(p.numero) === 'par');
  const processosImpar = processos.filter((p) => equipeDoNumero(p.numero) === 'impar');

  const onDragStart = (e, id) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setArrastandoId(id);
  };

  const onDragEnd = () => {
    setArrastandoId(null);
    setColunaHover(null);
  };

  const onDragOverCol = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (colunaHover !== colId) setColunaHover(colId);
  };

  const onDragLeaveCol = (e, colId) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (colunaHover === colId) setColunaHover(null);
    }
  };

  const onDropCol = (e, colId) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || arrastandoId;
    if (id) {
      const proc = processos.find((p) => p.id === id);
      if (proc && proc.status !== colId) {
        dispatch({ type: 'MOVER', id, status: colId });
        const colAlvo = STATUS.find((s) => s.id === colId);
        toast({
          tipo: 'info',
          titulo: `Processo movido para "${colAlvo?.label}"`,
          corpo: `${proc.numero}`,
        });
      }
    }
    setArrastandoId(null);
    setColunaHover(null);
  };

  return (
    <div className="page-content">
      {/* Cabeçalho da Página com IHC */}
      <div className="page-header-row">
        <div>
          <h2>Fila de Trabalho & Distribuição Par/Ímpar</h2>
          <p className="subtext">
            Distribuição de processos por dígito final e balanceamento da carga de trabalho entre os servidores da unidade.
          </p>
        </div>

        {/* Alternador de Visões */}
        <div className="page-actions">
          <div className="btn-group">
            <button
              className={`btn btn-sm ${visao === 'kanban' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setVisao('kanban')}
              title="Kanban tradicional por fase"
            >
              <Columns3 size={15} /> Kanban Fases
            </button>
            <button
              className={`btn btn-sm ${visao === 'split' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setVisao('split')}
              title="Visão comparativa Par vs Ímpar"
            >
              <Split size={15} /> Comparativo Par/Ímpar
            </button>
            <button
              className={`btn btn-sm ${visao === 'tabela' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setVisao('tabela')}
              title="Visão tabular completa"
            >
              <List size={15} /> Lista / Tabela
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Filtros Rápidos Par/Ímpar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn btn-sm ${filtroEquipe === 'todas' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFiltroEquipe('todas')}
          >
            Todos os Processos ({processos.length})
          </button>
          <button
            className={`btn btn-sm ${filtroEquipe === 'par' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFiltroEquipe('par')}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }} />
            Fila Par (Final 0, 2, 4, 6, 8) — {processosPar.length}
          </button>
          <button
            className={`btn btn-sm ${filtroEquipe === 'impar' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFiltroEquipe('impar')}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#db2777' }} />
            Fila Ímpar (Final 1, 3, 5, 7, 9) — {processosImpar.length}
          </button>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Regra ativa: <strong>{state.config.modo === 'par_impar' ? 'Par/Ímpar Parametrizável' : 'Round-Robin'}</strong>
        </div>
      </div>

      {/* Visão 1: Kanban Tradicional por Fase com Drag & Drop */}
      {visao === 'kanban' && (
        <div className="kanban-board">
          {STATUS.map((coluna) => {
            const itens = processosFiltrados.filter((p) => p.status === coluna.id);
            const isHover = colunaHover === coluna.id;

            return (
              <div
                key={coluna.id}
                className={`kanban-col ${isHover ? 'drag-over' : ''}`}
                onDragOver={(e) => onDragOverCol(e, coluna.id)}
                onDragLeave={(e) => onDragLeaveCol(e, coluna.id)}
                onDrop={(e) => onDropCol(e, coluna.id)}
              >
                <div className="kanban-col-header" style={{ borderTopColor: coluna.cor }}>
                  <div className="col-titulo">
                    <strong>{coluna.label}</strong>
                    <span className="col-count">{itens.length}</span>
                  </div>
                </div>

                <div className="kanban-col-body">
                  {itens.map((p) => {
                    const an = analistaPorId[p.analistaId];
                    const equipe = equipeDoNumero(p.numero);
                    const dig = ultimoDigito(p.numero);
                    const slaInfo = p.urgencia ? estadoSla(p.urgencia, now) : null;
                    const temPendencias = p.pendencias && p.pendencias.length > 0;

                    return (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, p.id)}
                        onDragEnd={onDragEnd}
                        className={`kanban-card ${arrastandoId === p.id ? 'arrastando' : ''} ${p.urgencia ? 'urgente' : ''}`}
                        onClick={() => abrirProcesso(p.id)}
                      >
                        {/* Linha 1: Número CNJ limpo e Tag Par/Ímpar mini */}
                        <div className="kc-top">
                          <span className="kc-numero mono">
                            {p.numero.slice(0, 6)}<b className={`kc-dig ${equipe}`}>{dig}</b>{p.numero.slice(7)}
                          </span>
                          <span className={`kc-tag-equipe ${equipe}`}>
                            {equipe === 'par' ? 'PAR' : 'ÍMPAR'}
                          </span>
                        </div>

                        {/* Linha 2: Classe e Assunto em tipografia limpa */}
                        <div className="kc-classe" title={p.classe}>
                          {p.classe}
                        </div>
                        <div className="kc-assunto" title={p.assunto}>
                          {p.assunto}
                        </div>

                        {/* Linha 3: Tags compactas de Urgência e Inconsistências */}
                        {(slaInfo || temPendencias) && (
                          <div className="kc-tags-row">
                            {slaInfo && (
                              <span className={`kc-sla-pill est-${slaInfo.estado}`} title={`${p.urgencia.label} · Prazo ${p.urgencia.horas}h`}>
                                <Siren size={11} />
                                <span>{p.urgencia.label}</span>
                                <em className="mono">{fmtRestante(slaInfo.restante)}</em>
                              </span>
                            )}
                            {temPendencias && (
                              <span className="kc-warn-pill" title={`${p.pendencias.length} pendência(s) de cadastro`}>
                                <AlertTriangle size={11} />
                                <span>{p.pendencias.length}</span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Linha 4: Rodapé minimalista com Servidor e Grip de Arrastar */}
                        <div className="kc-foot">
                          {an ? (
                            <div className="kc-analista">
                              <Avatar nome={an.nome} cor={an.cor} size={20} />
                              <span>{an.nome.split(' ')[0]}</span>
                            </div>
                          ) : (
                            <span className="kc-sem-analista">Sem servidor</span>
                          )}

                          <div className="kc-drag-grip" title="Arraste para mover entre etapas">
                            <GripVertical size={13} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {itens.length === 0 && (
                    <div className="kanban-empty">
                      <span>Nenhum processo nesta etapa</span>
                      <small style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Arraste um processo aqui</small>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Visão 2: Comparativo Split Par vs Ímpar (Demonstração do Pitch) */}
      {visao === 'split' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Lado Par */}
          <div className="card p-4" style={{ borderTop: '4px solid #0284c7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0284c7' }}>
                  <EquipeTag equipe="par" /> Esteira da Equipe Par
                </h3>
                <small className="text-muted">Processos com final 0, 2, 4, 6, 8</small>
              </div>
              <span className="col-count">{processosPar.length} processos</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {processosPar.map((p) => {
                const an = analistaPorId[p.analistaId];
                return (
                  <div
                    key={p.id}
                    className="card p-3 cursor-pointer"
                    style={{ background: 'var(--bg-main)' }}
                    onClick={() => abrirProcesso(p.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <NumeroProc numero={p.numero} destacar />
                      {p.urgencia && <SlaBadge u={p.urgencia} />}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>{p.classe}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.assunto}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
                      <small className="text-muted">Etapa: <b>{STATUS.find((s) => s.id === p.status)?.label}</b></small>
                      {an && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Avatar nome={an.nome} cor={an.cor} size={20} />
                          <small style={{ fontWeight: '600' }}>{an.nome.split(' ')[0]}</small>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lado Ímpar */}
          <div className="card p-4" style={{ borderTop: '4px solid #db2777' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#db2777' }}>
                  <EquipeTag equipe="impar" /> Esteira da Equipe Ímpar
                </h3>
                <small className="text-muted">Processos com final 1, 3, 5, 7, 9</small>
              </div>
              <span className="col-count">{processosImpar.length} processos</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {processosImpar.map((p) => {
                const an = analistaPorId[p.analistaId];
                return (
                  <div
                    key={p.id}
                    className="card p-3 cursor-pointer"
                    style={{ background: 'var(--bg-main)' }}
                    onClick={() => abrirProcesso(p.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <NumeroProc numero={p.numero} destacar />
                      {p.urgencia && <SlaBadge u={p.urgencia} />}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>{p.classe}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.assunto}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
                      <small className="text-muted">Etapa: <b>{STATUS.find((s) => s.id === p.status)?.label}</b></small>
                      {an && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Avatar nome={an.nome} cor={an.cor} size={20} />
                          <small style={{ fontWeight: '600' }}>{an.nome.split(' ')[0]}</small>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Visão 3: Tabela Completa */}
      {visao === 'tabela' && (
        <div className="table-responsive">
          <table className="pje-table">
            <thead>
              <tr>
                <th>Número do Processo</th>
                <th>Regra Par/Ímpar</th>
                <th>Classe & Assunto</th>
                <th>Etapa Atual</th>
                <th>Urgência SLA</th>
                <th>Servidor Designado</th>
              </tr>
            </thead>
            <tbody>
              {processosFiltrados.map((p) => {
                const an = analistaPorId[p.analistaId];
                const equipe = equipeDoNumero(p.numero);
                const st = STATUS.find((s) => s.id === p.status);

                return (
                  <tr key={p.id} onClick={() => abrirProcesso(p.id)} className="cursor-pointer">
                    <td>
                      <NumeroProc numero={p.numero} destacar />
                      <div className="text-muted small">{fmtDataHora(p.autuadoEm)}</div>
                    </td>
                    <td>
                      <EquipeTag equipe={equipe} />
                    </td>
                    <td>
                      <strong>{p.classe}</strong>
                      <div className="text-muted small">{p.assunto}</div>
                    </td>
                    <td>
                      <span
                        className="pill"
                        style={{
                          backgroundColor: `${st?.cor}18`,
                          color: st?.cor,
                          border: `1px solid ${st?.cor}40`,
                        }}
                      >
                        {st?.label}
                      </span>
                    </td>
                    <td>{p.urgencia ? <SlaBadge u={p.urgencia} /> : <span className="text-muted">—</span>}</td>
                    <td>
                      {an ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar nome={an.nome} cor={an.cor} size={24} />
                          <span style={{ fontWeight: '600' }}>{an.nome}</span>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
