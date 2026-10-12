import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, FileInput, Columns3, Siren, UserSearch, Settings, Bell, Search, Moon, Sun,
  DownloadCloud, Mail, X, CheckCheck, Sparkles, Database,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { USUARIO, VARA } from '../lib/mockData';
import { Avatar, TeamsLogo } from './ui';
import { tempoRelativo } from '../lib/format';
import { cnjValido } from '../lib/validators';

export const PAGINAS = {
  painel: { label: 'Painel Geral', icone: LayoutDashboard, titulo: 'Painel da Vara', sub: 'Visão executiva de acervo, urgências e produtividade' },
  triagem: { label: 'Triagem & Validação', icone: FileInput, titulo: 'Validação de Cadastros', sub: 'Auditoria de petições iniciais e conferência de dados CNJ' },
  urgencias: { label: 'Monitor de Urgências', icone: Siren, titulo: 'Monitor de Urgências e SLA', sub: 'Prazos regimentais de Réus Presos, Idosos e Tutelas' },
  fila: { label: 'Fila de Trabalho', icone: Columns3, titulo: 'Fila de Trabalho', sub: 'Distribuição automatizada Par/Ímpar e tramitação' },
  dossie: { label: 'Consulta de Partes', icone: UserSearch, titulo: 'Dossiê Unificado de Partes', sub: 'Histórico integrado por CPF/CNPJ e certidão de prevenção' },
  config: { label: 'Configurações', icone: Settings, titulo: 'Configurações da Vara', sub: 'Parâmetros de distribuição, prazos e equipes' },
};

export function Sidebar() {
  const { pagina, setPagina, processos, fecharProcesso } = useStore();
  const abertos = processos.filter((p) => p.status !== 'concluido');
  const badges = {
    triagem: { n: abertos.filter((p) => p.pendencias.length).length, cls: 'warn' },
    urgencias: { n: abertos.filter((p) => p.urgencia).length, cls: 'danger' },
    fila: { n: abertos.length, cls: '' },
  };

  const mudarAba = (id) => {
    fecharProcesso();
    setPagina(id);
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          PJe<span>+</span>
        </div>
        <div>
          <strong>PJe+ TJCE</strong>
          <small>Módulo de Inteligência</small>
        </div>
      </div>
      <nav>
        <span className="nav-sec">Operação</span>
        {Object.entries(PAGINAS).map(([id, p], i) => {
          const Ic = p.icone;
          const b = badges[id];
          return (
            <div key={id}>
              {i === 5 && <span className="nav-sec">Sistema</span>}
              <button id={`nav-${id}`} className={`nav-item ${pagina === id ? 'ativo' : ''}`} onClick={() => mudarAba(id)}>
                <Ic size={18} />
                <span>{p.label}</span>
                {b?.n > 0 && <em className={`nav-badge ${b.cls}`}>{b.n}</em>}
              </button>
            </div>
          );
        })}
      </nav>
      <div className="side-foot">
        <div className="vara">
          <small>Unidade Judiciária</small>
          <strong>{VARA}</strong>
        </div>
        <div className="status-line">
          <span className="dot ok" /> MNI / PJe Conectado
        </div>
        <IaStatus />
      </div>
    </aside>
  );
}

function IaStatus() {
  const [ia, setIa] = useState(null);
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setIa)
      .catch(() => setIa({ ia: false, offline: true }));
  }, []);
  return (
    <div className="status-line">
      <span className={`dot ${ia?.ia ? 'ok' : ia ? 'warn' : ''}`} />
      <Sparkles size={13} /> Assistente IA {ia?.ia ? 'Ativo' : ia?.offline ? 'Offline' : 'Pronto'}
    </div>
  );
}

export function Topbar() {
  const { pagina, state, dispatch, setIngestAberto, processos, abrirProcesso, abrirDossie } = useStore();
  const [q, setQ] = useState('');
  const [notifAberto, setNotifAberto] = useState(false);
  const pg = PAGINAS[pagina];
  const naoLidas = state.notificacoes.filter((n) => !n.lida).length;

  const buscar = (e) => {
    e.preventDefault();
    const t = q.trim();
    if (!t) return;
    const proc = processos.find((p) => p.numero === t || p.numero.replace(/\D/g, '') === t.replace(/\D/g, ''));
    if (proc) abrirProcesso(proc.id);
    else if (cnjValido(t)) abrirDossie(t);
    else abrirDossie(t);
    setQ('');
  };

  return (
    <header className="topbar">
      <div className="tb-title">
        <h1>{pg.titulo}</h1>
      </div>

      <div className="tb-right-cluster">
        <form className="tb-search" onSubmit={buscar}>
          <Search size={15} />
          <input id="busca-global" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nº CNJ, CPF/CNPJ ou parte…" />
          <kbd>Enter</kbd>
        </form>

        <button id="btn-capturar" className="btn btn-primary btn-sm" onClick={() => setIngestAberto(true)} title="Capturar novos processos distribuídos no PJe">
          <DownloadCloud size={16} /> Capturar Processos
        </button>

        <div className="tb-icons">
          <button id="btn-tema" className="icon-btn sm" onClick={() => dispatch({ type: 'TEMA' })} title="Alternar tema">
            {state.tema === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="notif-wrap">
            <button id="btn-notificacoes" className="icon-btn sm" onClick={() => setNotifAberto((v) => !v)} title="Notificações">
              <Bell size={16} />
              {naoLidas > 0 && <em className="bell-badge">{naoLidas}</em>}
            </button>
            {notifAberto && <PainelNotificacoes fechar={() => setNotifAberto(false)} />}
          </div>
        </div>

        <div className="user">
          <Avatar nome={USUARIO.nome} cor="#007A3D" size={32} />
          <div className="user-info">
            <strong>{USUARIO.nome}</strong>
            <small>{USUARIO.cargo}</small>
          </div>
        </div>
      </div>
    </header>
  );
}

function PainelNotificacoes({ fechar }) {
  const { state, dispatch, abrirProcesso, analistaPorId } = useStore();
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && !e.target.closest('#btn-notificacoes') && fechar();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [fechar]);
  return (
    <div className="notif-panel" ref={ref}>
      <header>
        <strong>Notificações do Sistema</strong>
        <button className="link" onClick={() => dispatch({ type: 'LER_TODAS' })} style={{ background: 'none', border: 'none', color: 'var(--pje-blue)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <CheckCheck size={14} /> Marcar lidas
        </button>
      </header>
      <div className="notif-list">
        {state.notificacoes.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            <Bell size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            <p>Nenhuma notificação recente pendente.</p>
          </div>
        )}
        {state.notificacoes.map((n) => (
          <button
            key={n.id}
            className={`notif-item ${n.lida ? '' : 'nova'}`}
            onClick={() => {
              if (n.processoId) abrirProcesso(n.processoId);
              fechar();
            }}
          >
            <span className={`canal canal-${n.canal}`}>{n.canal === 'teams' ? <TeamsLogo size={16} /> : n.canal === 'email' ? <Mail size={15} /> : <Database size={15} />}</span>
            <span className="ni-body">
              <strong>{n.titulo}</strong>
              <small>{n.corpo}</small>
              <em>
                {n.canal === 'teams' ? 'Teams' : n.canal === 'email' ? 'E-mail' : 'PJe+'} · {analistaPorId[n.analistaId]?.nome?.split(' ')[0] ?? 'Secretaria'} · {tempoRelativo(n.em)}
              </em>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ToastStack() {
  const { toasts, fecharToast, abrirProcesso } = useStore();
  return (
    <div className="toasts">
      {toasts.map((t) =>
        t.tipo === 'teams' ? (
          <div key={t.id} className={`toast teams nivel-${t.nivel || 'alto'}`}>
            <div className="teams-h">
              <TeamsLogo size={16} />
              <span>Microsoft Teams · TJCE Alertas</span>
              <em>agora</em>
              <button onClick={() => fecharToast(t.id)} aria-label="Fechar">
                <X size={14} />
              </button>
            </div>
            <div className="teams-b">
              <div className="bot">
                <Siren size={15} />
              </div>
              <div>
                <small>Notificação enviada a: {t.analista}</small>
                <strong>{t.titulo}</strong>
                <p>{t.corpo}</p>
                <div className="teams-actions">
                  <button
                    onClick={() => {
                      abrirProcesso(t.processoId);
                      fecharToast(t.id);
                    }}
                  >
                    Abrir Processo
                  </button>
                  <button onClick={() => fecharToast(t.id)}>Dispensar</button>
                </div>
              </div>
            </div>
            <div className="toast-bar" style={{ animationDuration: '9s' }} />
          </div>
        ) : (
          <div key={t.id} className={`toast simples ${t.tipo}`}>
            <span className="t-ic">{t.tipo === 'email' ? <Mail size={16} /> : <CheckCheck size={16} />}</span>
            <div>
              <strong>{t.titulo}</strong>
              {t.corpo && <p>{t.corpo}</p>}
            </div>
            <button onClick={() => fecharToast(t.id)} aria-label="Fechar">
              <X size={14} />
            </button>
            <div className="toast-bar" style={{ animationDuration: '5s' }} />
          </div>
        ),
      )}
    </div>
  );
}
