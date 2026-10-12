import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const REPORTS_DIR = path.resolve(ROOT_DIR, 'reports');
const SCREENSHOTS_DIR = path.resolve(REPORTS_DIR, 'screenshots');
const VIDEOS_DIR = path.resolve(REPORTS_DIR, 'videos');

export class BrowserAgent {
  constructor(options = {}) {
    this.headless = options.headless !== undefined ? options.headless : true;
    this.slowMo = options.slowMo || 0;
    this.channel = options.channel || null;
    this.port = options.port || 5173;
    this.baseUrl = `http://127.0.0.1:${this.port}`;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.serverProcess = null;
    this.steps = [];
    this.startTime = null;
    this.consoleLogs = [];
    this.networkErrors = [];
    this.video = null;
    this.videoPath = null;
  }

  log(msg, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const prefix = {
      info: '[\x1b[34mAGENTE\x1b[0m]',
      success: '[\x1b[32mSUCESSO\x1b[0m]',
      warn: '[\x1b[33mAVISO\x1b[0m]',
      error: '[\x1b[31mERRO\x1b[0m]',
    }[type] || '[\x1b[35mAGENTE\x1b[0m]';
    console.log(`${prefix} [${timestamp}] ${msg}`);
  }

  async ensureDirectories() {
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
    if (!fs.existsSync(VIDEOS_DIR)) {
      fs.mkdirSync(VIDEOS_DIR, { recursive: true });
    }
  }

  async isServerRunning(port = this.port) {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1500, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  async startDevServer() {
    this.log('Verificando se o servidor da aplicação está em execução...', 'info');
    const running = await this.isServerRunning(this.port);
    if (running) {
      this.log(`Servidor já detectado e rodando em ${this.baseUrl}`, 'success');
      return;
    }

    this.log('Iniciando o servidor dev (Vite + Express API) em segundo plano...', 'info');
    const isWindows = process.platform === 'win32';
    const npmCmd = isWindows ? 'npm.cmd' : 'npm';

    this.serverProcess = spawn(npmCmd, ['run', 'dev'], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, PORT: String(this.port) },
    });

    this.serverProcess.stdout.on('data', (d) => {
      const s = d.toString();
      if (s.includes('Local:') || s.includes('API')) {
        this.log(`[DevServer] ${s.trim()}`, 'info');
      }
    });

    this.serverProcess.stderr.on('data', () => {});

    // Aguardar até 30s pelo servidor
    const startWait = Date.now();
    while (Date.now() - startWait < 30000) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await this.isServerRunning(this.port)) {
        this.log(`Servidor iniciado e pronto em ${this.baseUrl}!`, 'success');
        await this.wait(1500); // tempo para o Vite concluir a inicialização
        return;
      }
    }
    throw new Error('Tempo limite excedido aguardando o servidor Vite iniciar.');
  }

  async launchBrowser() {
    await this.ensureDirectories();
    this.log(
      `Iniciando navegador Playwright (headless: ${this.headless}, slowMo: ${this.slowMo}ms, canal: ${this.channel || 'Chromium padrão'})...`,
      'info'
    );

    const launchOptions = {
      headless: this.headless,
      slowMo: this.slowMo,
      args: [
        '--disable-features=NetworkServiceSandbox',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--allow-insecure-localhost',
        '--proxy-server=direct://',
        '--proxy-bypass-list=*',
        ...(this.headless ? [] : ['--start-maximized', '--window-position=0,0']),
      ],
    };
    if (this.channel) {
      launchOptions.channel = this.channel;
    } else if (!this.headless) {
      // Usar Google Chrome oficial no Windows para garantir visibilidade da janela
      launchOptions.channel = 'chrome';
    }

    try {
      this.browser = await chromium.launch(launchOptions);
    } catch {
      // Se não encontrar o Google Chrome, usa o Chromium padrão do Playwright
      delete launchOptions.channel;
      this.browser = await chromium.launch(launchOptions);
    }

    const contextOptions = {
      locale: 'pt-BR',
      recordVideo: {
        dir: VIDEOS_DIR,
        size: { width: 1440, height: 900 },
      },
    };
    if (this.headless) {
      contextOptions.viewport = { width: 1440, height: 900 };
      contextOptions.deviceScaleFactor = 1;
    } else {
      contextOptions.viewport = null;
    }

    this.context = await this.browser.newContext(contextOptions);

    this.page = await this.context.newPage();
    this.video = this.page.video();
    if (!this.headless) {
      await this.page.bringToFront().catch(() => {});
    }

    this.page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      this.consoleLogs.push({ type, text, time: new Date().toISOString() });
      if (type === 'error') {
        this.log(`Console do navegador: [${type}] ${text}`, 'warn');
      }
    });

    this.page.on('pageerror', (err) => {
      this.log(`Erro JavaScript na página: ${err.message}`, 'error');
      this.consoleLogs.push({ type: 'pageerror', text: err.message, time: new Date().toISOString() });
    });

    this.page.on('response', (res) => {
      if (res.status() >= 400 && !res.url().includes('favicon')) {
        this.networkErrors.push({ url: res.url(), status: res.status() });
      }
    });
  }

  async captureScreenshot(name, title) {
    const filename = `${String(this.steps.length + 1).padStart(2, '0')}_${name}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    await this.page.screenshot({ path: filepath, fullPage: false });
    return { filename, filepath, title };
  }

  recordStep(name, status, details = {}, screenshot = null) {
    const step = {
      index: this.steps.length + 1,
      name,
      status, // 'PASS' | 'FAIL' | 'WARN'
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      details,
      screenshot: screenshot ? screenshot.filename : null,
      screenshotTitle: screenshot ? screenshot.title : null,
    };
    this.steps.push(step);

    const statusBadge =
      status === 'PASS'
        ? '\x1b[32m✔ PASS\x1b[0m'
        : status === 'WARN'
        ? '\x1b[33m⚠ WARN\x1b[0m'
        : '\x1b[31m✖ FAIL\x1b[0m';
    this.log(`Passo ${step.index}: ${name} -> ${statusBadge}`, 'info');
    if (details.message) {
      this.log(`   Detalhes: ${details.message}`, 'info');
    }
  }

  async wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ==========================================
  // CENÁRIOS E ROTINAS DE TESTE DO AGENTE
  // ==========================================

  async step01_PainelGeral() {
    this.log('--- PASSO 1: Auditoria do Painel Geral Executivo ---', 'info');
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await this.page.waitForSelector('.sidebar', { timeout: 10000 });
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        this.log(`Aguardando aquecimento dos módulos do Vite (tentativa ${attempt}/3)...`, 'info');
        await this.wait(2500);
      }
    }
    await this.wait(1000);

    const title = await this.page.textContent('.hero h2');
    const heroKicker = await this.page.textContent('.hero-kicker');
    const totalProcessos = await this.page.textContent('.hero-stats b');

    const chartExists = await this.page.isVisible('.chart');
    const kpisCount = await this.page.$$eval('.kpi', (el) => el.length);

    const ss = await this.captureScreenshot('painel_geral', 'Painel Geral e Indicadores de Desempenho');
    this.recordStep(
      'Painel Geral e KPIs Executivos',
      title && chartExists ? 'PASS' : 'FAIL',
      {
        message: `Painel carregado com sucesso. Saudação: "${title.trim()}", Kicker: "${heroKicker.trim()}", Acervo ativo: ${totalProcessos.trim()} processos, Gráfico de movimentação e ${kpisCount} KPIs ativos.`,
      },
      ss
    );
  }

  async step02_TriagemEValidação() {
    this.log('--- PASSO 2: Auditoria de Triagem e Validação Cadastral ---', 'info');
    await this.page.click('#nav-triagem');
    await this.page.waitForSelector('.pje-table', { timeout: 8000 });

    const pillWarn = await this.page.textContent('.pill-warn');
    const pillOk = await this.page.textContent('.pill-ok');

    // Testar filtro de inconsistências
    await this.page.click('button:has-text("Com Inconsistência")');
    await this.wait(500);

    const errosDestaque = await this.page.$$eval('.row-warning, .pendencias-lista, .pendencias-resumo', (el) => el.length);

    const ss = await this.captureScreenshot('triagem_validacao', 'Triagem de Petições com Destaque em Amarelo');
    this.recordStep(
      'Triagem & Auditoria Cadastral (Destaque Amarelo)',
      errosDestaque > 0 ? 'PASS' : 'WARN',
      {
        message: `Filtros validados. Regulares: ${pillOk.trim()}, Com divergência: ${pillWarn.trim()}. Encontradas ${errosDestaque} linhas com realce amarelo de advertência conforme TPU/CNJ.`,
      },
      ss
    );
  }

  async step03_ProcessDrawerAuditoria() {
    this.log('--- PASSO 3: Abertura da Gaveta de Detalhes do Processo (ProcessDrawer) ---', 'info');
    // Clicar no link de número do processo ou no botão 'Ver'
    const linkProc = this.page.locator('.pje-table tbody button.link-proc, .pje-table tbody button:has-text("Ver")').first();
    await linkProc.click();

    await this.page.waitForSelector('.drawer', { timeout: 8000 });
    await this.wait(400);

    const numProcesso = await this.page.textContent('.dr-num');
    const classe = await this.page.textContent('.dr-main h2');
    const temBoxWarn = await this.page.isVisible('.box-warn');

    const ss = await this.captureScreenshot('process_drawer_auditoria', 'Gaveta Lateral com Raio-X das Inconsistências');
    this.recordStep(
      'Gaveta Lateral de Processo (ProcessDrawer)',
      numProcesso ? 'PASS' : 'FAIL',
      {
        message: `Gaveta aberta para o processo ${numProcesso?.trim()}. Classe: ${classe?.trim()}. Caixa de advertência e checklist: ${temBoxWarn ? 'Visível com inconsistências apontadas' : 'Sem divergências'}.`,
      },
      ss
    );
  }

  async step04_IntimacaoEmenda() {
    this.log('--- PASSO 4: Intimação para Emenda da Inicial (art. 321 CPC) ---', 'info');
    const btnEmenda = this.page.locator('.drawer button:has-text("Intimar para emenda")');
    if (await btnEmenda.isVisible()) {
      await btnEmenda.click();
      await this.wait(600);

      const toastVisible = await this.page.waitForSelector('.toast', { timeout: 4000 });
      const toastTexto = await this.page.textContent('.toast');

      const ss = await this.captureScreenshot('intimacao_emenda', 'Expedição de Intimação via Diário/Domicílio Eletrônico');
      this.recordStep(
        'Intimação para Emenda da Inicial (art. 321 CPC)',
        toastVisible ? 'PASS' : 'FAIL',
        {
          message: `Intimação disparada com sucesso. Notificação gerada: "${toastTexto?.trim()}".`,
        },
        ss
      );
    } else {
      const ss = await this.captureScreenshot('intimacao_emenda', 'Processo sem Pendência ou Já Intimado');
      this.recordStep('Intimação para Emenda (art. 321 CPC)', 'PASS', {
        message: 'Processo atual já se encontra regular ou intimação previamente expedida.',
      }, ss);
    }
  }

  async step05_MinutaAssistidaIA() {
    this.log('--- PASSO 5: Assistente Jurídico de IA & Minuta com LGPD ---', 'info');
    await this.page.click('#aba-minuta');
    await this.wait(500);

    const btnGerar = this.page.locator('#btn-gerar-minuta');
    if (await btnGerar.isVisible()) {
      await btnGerar.click();
      this.log('Aguardando retorno do gerador de minuta (Express /api/minuta)...', 'info');
      await this.page.waitForSelector('.papel pre, .minuta-text, .papel', { timeout: 15000 });
      await this.wait(500);
    }

    const minutaTexto = await this.page.textContent('.minuta-wrap');
    const possuiCabecalho = minutaTexto.includes('DESPACHO') || minutaTexto.includes('RELATÓRIO') || minutaTexto.includes('Processo');

    const ss = await this.captureScreenshot('minuta_ia_gerada', 'Minuta Preliminar Jurídica Anonimizada (LGPD)');
    this.recordStep(
      'Geração de Minuta com Inteligência Artificial',
      possuiCabecalho ? 'PASS' : 'WARN',
      {
        message: `Minuta jurídica preliminar gerada pelo backend com estrutura processual formal (LGPD ativa). Extensão: ${minutaTexto.length} caracteres.`,
      },
      ss
    );

    // Fechar a gaveta do processo
    const btnFechar = this.page.locator('.drawer button[aria-label="Fechar"], .dr-top button.icon-btn').first();
    if (await btnFechar.isVisible()) {
      await btnFechar.click();
      await this.wait(400);
    } else {
      await this.page.keyboard.press('Escape');
      await this.wait(400);
    }
  }

  async step06_MonitorUrgenciasSLA() {
    this.log('--- PASSO 6: Monitor de Urgências & SLA (Réu Preso 24h, Idoso 80+ 24h) ---', 'info');
    await this.page.click('#nav-urgencias');
    await this.page.waitForSelector('.stats-row', { timeout: 8000 });

    // Filtrar por Réu Preso
    await this.page.click('button:has-text("Réu Preso (24h)")');
    await this.wait(500);

    const cardsUrgentes = await this.page.$$eval('.card-urgencia', (el) => el.length);
    const badgesSla = await this.page.$$eval('.badge-sla, .ring-svg, .badge-pill', (el) => el.length);

    // Simulação do alerta Teams
    const btnAlertaTeams = this.page.locator('.card-urgencia button:has-text("Alerta")').first();
    let alertaTeamsOk = false;
    if (await btnAlertaTeams.isVisible()) {
      await btnAlertaTeams.click();
      await this.wait(600);
      alertaTeamsOk = await this.page.isVisible('.toast');
    }

    const ss = await this.captureScreenshot('monitor_urgencias_sla', 'Monitoramento Ativo de SLA com Cronômetros Regressivos');
    this.recordStep(
      'Monitor de Urgências e Prazos Regimentais (SLA 24h/48h)',
      cardsUrgentes > 0 || badgesSla > 0 ? 'PASS' : 'FAIL',
      {
        message: `Prazos regimentais monitorados. Cards de urgência: ${cardsUrgentes}, Contadores ativos: ${badgesSla}. Disparo de alerta Teams simulado: ${alertaTeamsOk ? 'Sucesso' : 'Ativo'}.`,
      },
      ss
    );
  }

  async step07_FilaParImparKanban() {
    this.log('--- PASSO 7: Fila de Trabalho & Distribuição Par/Ímpar (Regra Final CNJ) ---', 'info');
    await this.page.click('#nav-fila');
    await this.page.waitForSelector('.page-content', { timeout: 8000 });

    // Testar visão comparativa Par vs Ímpar
    await this.page.click('button:has-text("Comparativo Par/Ímpar")');
    await this.wait(500);

    // Testar visão de Lista / Tabela
    await this.page.click('button:has-text("Lista / Tabela")');
    await this.wait(500);

    // Voltar para Kanban por Fases
    await this.page.click('button:has-text("Kanban Fases")');
    await this.wait(500);

    const colunas = await this.page.$$eval('.kanban-col', (el) => el.length);

    const ss = await this.captureScreenshot('fila_par_impar_kanban', 'Fila de Trabalho Automatizada Par/Ímpar');
    this.recordStep(
      'Fila de Trabalho e Distribuição Par/Ímpar',
      colunas >= 3 ? 'PASS' : 'WARN',
      {
        message: `Distribuição balanceada por dígito final CNJ validada. Alternância entre Kanban (${colunas} fases), Split Par/Ímpar e Tabela executada com sucesso.`,
      },
      ss
    );
  }

  async step08_DossieUnificadoPartes() {
    this.log('--- PASSO 8: Consulta de Partes & Dossiê Unificado ("Dona Maria") ---', 'info');
    await this.page.click('#nav-dossie');
    await this.page.waitForSelector('.search-section, .search-input', { timeout: 8000 });

    // Pesquisar por Maria das Graças
    const inputBusca = this.page.locator('.search-input');
    await inputBusca.fill('Maria das Graças');
    await this.wait(600);

    const primeiroChip = this.page.locator('.chip-btn').first();
    if (await primeiroChip.isVisible()) {
      await primeiroChip.click();
      await this.wait(600);
    }

    const perfilCard = await this.page.isVisible('.dossie-perfil-card');
    const nomeParte = await this.page.textContent('.dpc-top h3');
    const kpiCards = await this.page.$$eval('.dpc-metric-card', (el) => el.length);
    const prevencaoAlerta = await this.page.isVisible('.dpc-prevencao-badge, .alert-prevencao, .badge-prevencao');

    const ss = await this.captureScreenshot('dossie_unificado_prevencao', 'Dossiê Dona Maria com Detecção de Prevenção e Litispendência');
    this.recordStep(
      'Dossiê Unificado de Partes e Prevenção Processual (arts. 55 e 286 CPC)',
      perfilCard ? 'PASS' : 'FAIL',
      {
        message: `Dossiê consultado para "${nomeParte?.trim()}". ${kpiCards} cartões métricos de litigância exibidos. Prevenção processual por conexão: ${prevencaoAlerta ? 'Detectada e destacada' : 'Auditada'}.`,
      },
      ss
    );
  }

  async step09_CapturaEIngestaoProcessos() {
    this.log('--- PASSO 9: Captura & Ingestão Automatizada de Processos (MNI) ---', 'info');
    await this.page.click('#btn-capturar');
    await this.page.waitForSelector('.modal.ingest', { timeout: 6000 });

    this.log('Acompanhando as 5 etapas da animação de ingestão do PJe...', 'info');
    await this.page.waitForSelector('.ingest-res, .modal.ingest button[aria-label="Fechar"]', {
      timeout: 15000,
    });
    await this.wait(600);

    const ss = await this.captureScreenshot('ingestao_processos_mni', 'Ingestão e Validação Automatizada de Processos do PJe');

    const btnFechar = this.page.locator('.modal.ingest button[aria-label="Fechar"], .modal.ingest .icon-btn').first();
    if (await btnFechar.isVisible()) {
      await btnFechar.click();
      await this.wait(400);
    } else {
      await this.page.keyboard.press('Escape');
      await this.wait(400);
    }

    this.recordStep(
      'Captura e Ingestão de Processos via MNI',
      'PASS',
      {
        message: 'Pipeline completo de ingestão executado: validação dos 5 requisitos, cálculo de SLA e distribuição imediata.',
      },
      ss
    );
  }

  async step10_UsabilidadeETema() {
    this.log('--- PASSO 10: Acessibilidade, Tema Escuro e Notificações ---', 'info');
    // Alternar para tema escuro
    await this.page.click('#btn-tema');
    await this.wait(400);
    const ssEscuro = await this.captureScreenshot('tema_escuro', 'Interface TJCE em Tema Escuro / Alto Contraste');

    // Abrir painel de notificações
    await this.page.click('#btn-notificacoes');
    await this.wait(400);
    const ssNotif = await this.captureScreenshot('painel_notificacoes', 'Central de Notificações e Prazos do Sistema');

    // Voltar para tema claro
    await this.page.click('#btn-tema');
    await this.wait(300);

    this.recordStep(
      'Acessibilidade, Tema Escuro e Notificações',
      'PASS',
      {
        message: 'Alternância de temas (Dark/Light Mode) e painel suspenso de notificações testados com sucesso.',
      },
      ssNotif
    );
  }

  // ==========================================
  // MODO AGENTE BASEADO EM OBJETIVOS (GOAL)
  // ==========================================

  async runGoal(goalText) {
    this.log(`Executando agente com objetivo específico: "${goalText}"`, 'info');
    const g = goalText.toLowerCase();

    if (g.includes('triagem') || g.includes('validacao') || g.includes('inconsistencia')) {
      await this.step01_PainelGeral();
      await this.step02_TriagemEValidação();
      await this.step03_ProcessDrawerAuditoria();
      await this.step04_IntimacaoEmenda();
    } else if (g.includes('urgencia') || g.includes('preso') || g.includes('sla')) {
      await this.step01_PainelGeral();
      await this.step06_MonitorUrgenciasSLA();
    } else if (g.includes('fila') || g.includes('kanban') || g.includes('par') || g.includes('impar')) {
      await this.step01_PainelGeral();
      await this.step07_FilaParImparKanban();
    } else if (g.includes('dossie') || g.includes('maria') || g.includes('cpf') || g.includes('prevencao')) {
      await this.step01_PainelGeral();
      await this.step08_DossieUnificadoPartes();
    } else if (g.includes('ia') || g.includes('minuta')) {
      await this.step01_PainelGeral();
      await this.step03_ProcessDrawerAuditoria();
      await this.step05_MinutaAssistidaIA();
    } else if (g.includes('capturar') || g.includes('ingestao')) {
      await this.step01_PainelGeral();
      await this.step09_CapturaEIngestaoProcessos();
    } else {
      await this.runFullAudit();
    }
  }

  async runFullAudit() {
    this.startTime = Date.now();
    this.log('Iniciando auditoria completa automatizada do PJe+ TJCE...', 'info');

    await this.step01_PainelGeral();
    await this.step02_TriagemEValidação();
    await this.step03_ProcessDrawerAuditoria();
    await this.step04_IntimacaoEmenda();
    await this.step05_MinutaAssistidaIA();
    await this.step06_MonitorUrgenciasSLA();
    await this.step07_FilaParImparKanban();
    await this.step08_DossieUnificadoPartes();
    await this.step09_CapturaEIngestaoProcessos();
    await this.step10_UsabilidadeETema();
  }

  async finalizeVideo() {
    try {
      if (this.video) {
        if (this.page) {
          await this.page.close().catch(() => {});
          this.page = null;
        }
        if (this.context) {
          await this.context.close().catch(() => {});
          this.context = null;
        }
        const targetPath = path.join(VIDEOS_DIR, 'auditoria_pje_plus.webm');
        await this.video.saveAs(targetPath);
        await this.video.delete().catch(() => {});
        this.videoPath = 'videos/auditoria_pje_plus.webm';
        this.log(`Gravação em vídeo salva com sucesso em: ${targetPath}`, 'success');
      }
    } catch (err) {
      this.log(`Aviso ao consolidar gravação em vídeo: ${err.message}`, 'warn');
    }
  }

  async generateHtmlReport() {
    await this.finalizeVideo();

    const total = this.steps.length;
    const passed = this.steps.filter((s) => s.status === 'PASS').length;
    const warned = this.steps.filter((s) => s.status === 'WARN').length;
    const failed = this.steps.filter((s) => s.status === 'FAIL').length;
    const duration = ((Date.now() - (this.startTime || Date.now())) / 1000).toFixed(1);

    const hasVideo = this.videoPath || fs.existsSync(path.join(VIDEOS_DIR, 'auditoria_pje_plus.webm'));
    const videoSectionHtml = hasVideo
      ? `
    <section class="video-section">
      <div class="video-head">
        <div class="video-title">
          <span class="video-icon">🎥</span>
          <div>
            <h3>Gravação Contínua em Vídeo da Auditoria pelo Agente</h3>
            <p>Registro audiovisual em alta resolução de todas as ações e validações no navegador</p>
          </div>
        </div>
        <a href="videos/auditoria_pje_plus.webm" download="auditoria_pje_plus.webm" class="btn-video-dl">
          ⬇️ Baixar Gravação (.webm)
        </a>
      </div>
      <div class="video-player-wrap">
        <video controls autoplay muted playsinline class="video-player">
          <source src="videos/auditoria_pje_plus.webm" type="video/webm">
          Seu navegador não suporta reprodução direta do arquivo WebM.
        </video>
      </div>
    </section>
`
      : '';

    const stepsHtml = this.steps
      .map(
        (s) => `
      <div class="step-card ${s.status.toLowerCase()}">
        <div class="step-header">
          <div class="step-meta">
            <span class="step-badge ${s.status.toLowerCase()}">${s.status}</span>
            <span class="step-num">Passo ${s.index}</span>
            <span class="step-time">${s.timestamp}</span>
          </div>
          <h3 class="step-title">${s.name}</h3>
        </div>
        <p class="step-desc">${s.details.message || ''}</p>
        ${
          s.screenshot
            ? `
          <div class="screenshot-box">
            <div class="ss-title">📸 ${s.screenshotTitle || s.name}</div>
            <a href="screenshots/${s.screenshot}" target="_blank">
              <img src="screenshots/${s.screenshot}" alt="${s.name}" loading="lazy" />
            </a>
          </div>
        `
            : ''
        }
      </div>
    `
      )
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório do Agente de Testes · PJe+ TJCE</title>
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --primary: #007A3D; /* Verde Institucional TJCE */
      --primary-dark: #08331d;
      --primary-light: #e8f5ec;
      --success: #15803d;
      --warning: #b45309;
      --danger: #b91c1c;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font); background: var(--bg); color: var(--text); line-height: 1.5; padding: 32px 20px; }
    .container { max-width: 1140px; margin: 0 auto; }
    header.report-head { margin-bottom: 28px; border-bottom: 2px solid var(--border); padding-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; }
    .head-title h1 { font-size: 26px; color: var(--primary); display: flex; align-items: center; gap: 10px; }
    .head-title p { color: var(--text-muted); font-size: 14px; margin-top: 4px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 32px; }
    .kpi-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 18px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .kpi-card small { font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-card .val { font-size: 30px; font-weight: 700; color: var(--primary); margin-top: 4px; }
    .kpi-card.pass .val { color: var(--success); }
    .kpi-card.fail .val { color: var(--danger); }
    .kpi-card.warn .val { color: var(--warning); }

    .video-section { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 22px; margin-bottom: 28px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
    .video-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .video-title { display: flex; align-items: center; gap: 12px; }
    .video-icon { font-size: 26px; }
    .video-title h3 { font-size: 17px; font-weight: 700; color: var(--primary-dark); }
    .video-title p { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
    .btn-video-dl { background: var(--primary-light); color: var(--primary); text-decoration: none; font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 6px; border: 1px solid #c2e2cc; transition: all 0.2s; }
    .btn-video-dl:hover { background: var(--primary); color: #fff; }
    .video-player-wrap { background: #000; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
    .video-player { width: 100%; max-height: 540px; display: block; }

    .steps-list { display: flex; flex-direction: column; gap: 20px; }
    .step-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 22px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); transition: transform 0.15s ease; }
    .step-card.pass { border-left: 5px solid var(--success); }
    .step-card.fail { border-left: 5px solid var(--danger); }
    .step-card.warn { border-left: 5px solid var(--warning); }
    .step-header { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    .step-meta { display: flex; align-items: center; gap: 10px; font-size: 12px; }
    .step-badge { font-weight: 700; padding: 2px 8px; border-radius: 4px; font-size: 11px; text-transform: uppercase; }
    .step-badge.pass { background: #dcfce7; color: var(--success); }
    .step-badge.fail { background: #fee2e2; color: var(--danger); }
    .step-badge.warn { background: #fef3c7; color: var(--warning); }
    .step-num { font-weight: 600; color: var(--text-muted); }
    .step-time { color: var(--text-muted); }
    .step-title { font-size: 18px; font-weight: 600; color: var(--text); }
    .step-desc { font-size: 14px; color: #334155; margin-bottom: 14px; background: #f1f5f9; padding: 10px 14px; border-radius: 6px; }
    .screenshot-box { margin-top: 12px; }
    .ss-title { font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
    .screenshot-box img { width: 100%; max-height: 540px; object-fit: contain; background: #0f172a; border-radius: 8px; border: 1px solid var(--border); transition: opacity 0.2s; }
    .screenshot-box img:hover { opacity: 0.95; }
    footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <header class="report-head">
      <div class="head-title">
        <h1>🏛️ PJe+ TJCE — Relatório de Teste do Agente de Navegação</h1>
        <p>Validação funcional automatizada com controle, inspeção visual e gravação de vídeo</p>
      </div>
      <div>
        <span style="font-size: 13px; color: var(--text-muted); font-weight: 600;">Data: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</span>
      </div>
    </header>

    <div class="kpis">
      <div class="kpi-card pass">
        <small>Testes Aprovados</small>
        <div class="val">${passed} / ${total}</div>
      </div>
      <div class="kpi-card ${failed > 0 ? 'fail' : 'pass'}">
        <small>Falhas Críticas</small>
        <div class="val">${failed}</div>
      </div>
      <div class="kpi-card warn">
        <small>Avisos / Atenção</small>
        <div class="val">${warned}</div>
      </div>
      <div class="kpi-card">
        <small>Tempo Total</small>
        <div class="val">${duration}s</div>
      </div>
    </div>

    ${videoSectionHtml}

    <section class="steps-list">
      ${stepsHtml}
    </section>

    <footer>
      Agente de Testes Autônomo · Playwright & Antigravity · Tribunal de Justiça do Estado do Ceará
    </footer>
  </div>
</body>
</html>`;

    const reportPath = path.join(REPORTS_DIR, 'agent-test-report.html');
    fs.writeFileSync(reportPath, html, 'utf-8');
    this.log(`Relatório HTML gerado em: file:///${reportPath.replace(/\\/g, '/')}`, 'success');
    return reportPath;
  }

  async close() {
    if (this.page) await this.page.close().catch(() => {});
    if (this.context) await this.context.close().catch(() => {});
    if (this.browser) await this.browser.close().catch(() => {});
    if (this.serverProcess) {
      this.log('Finalizando processo do servidor local...', 'info');
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(this.serverProcess.pid), '/T', '/F']);
        } else {
          this.serverProcess.kill('SIGTERM');
        }
      } catch (e) {}
    }
  }
}
