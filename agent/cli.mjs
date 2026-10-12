#!/usr/bin/env node

import path from 'path';
import { BrowserAgent } from './browser-agent.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    headless: true,
    slowMo: 0,
    goal: null,
    channel: null,
    port: 5173,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--headed' || arg === '-h') {
      options.headless = false;
    } else if (arg === '--slowmo' && args[i + 1]) {
      options.slowMo = parseInt(args[++i], 10) || 300;
    } else if (arg === '--goal' && args[i + 1]) {
      options.goal = args[++i];
    } else if (arg === '--chrome') {
      options.channel = 'chrome';
    } else if (arg === '--edge') {
      options.channel = 'msedge';
    } else if (arg === '--port' && args[i + 1]) {
      options.port = parseInt(args[++i], 10) || 5173;
    }
  }

  // Se rodar com --headed e não tiver especificado slowMo, definir um valor agradável para visualização
  if (!options.headless && options.slowMo === 0) {
    options.slowMo = 600;
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log('=====================================================');
  console.log('🏛️  PJe+ TJCE — Agente Autônomo de Controle do Browser');
  console.log('=====================================================');
  console.log(`Modo: ${options.headless ? 'Headless (Segundo plano)' : 'Headed (Navegador Visível na Tela)'}`);
  if (options.slowMo > 0) console.log(`Velocidade: Atraso de ${options.slowMo}ms entre ações`);
  if (options.goal) console.log(`Objetivo do Agente: "${options.goal}"`);
  console.log('=====================================================\n');

  const agent = new BrowserAgent(options);

  try {
    await agent.startDevServer();
    await agent.launchBrowser();

    if (options.goal) {
      await agent.runGoal(options.goal);
    } else {
      await agent.runFullAudit();
    }

    if (!options.headless) {
      console.log('\n⏳ Concluindo testes na tela... finalizando gravação de vídeo...');
      await agent.wait(3000);
    }

    const reportPath = await agent.generateHtmlReport();

    console.log('\n=====================================================');
    console.log('✅ AUDITORIA CONCLUÍDA PELO AGENTE DE BROWSER!');
    console.log(`📄 Relatório Visual: file:///${reportPath.replace(/\\/g, '/')}`);
    if (agent.videoPath) {
      console.log(`🎥 Vídeo Gravado: file:///${path.resolve(reportPath, '..', agent.videoPath).replace(/\\/g, '/')}`);
    }
    console.log('=====================================================');

    if (!options.headless) {
      const { exec } = await import('child_process');
      exec(`start "" "${reportPath}"`);
    }
  } catch (err) {
    console.error('\n❌ Erro durante a execução do agente:', err);
    process.exitCode = 1;
  } finally {
    await agent.close();
  }
}

main();
