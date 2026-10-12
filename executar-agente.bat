@echo off
chcp 65001 > nul
title PJe+ TJCE - Agente de Testes do Browser
echo ===================================================================
echo 🏛️  PJe+ TJCE — Agente Autônomo de Navegação e Auditoria
echo ===================================================================
echo Abrindo o Google Chrome na sua tela e executando a suíte de testes...
echo.
npm run test:agent:headed
echo.
pause
