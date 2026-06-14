@echo off
setlocal EnableDelayedExpansion
title MarsBase Voting — Cloudflare Deploy
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║    MarsBase Voting Template — Cloudflare Deployer    ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: ── Step 1: Check Node.js ──────────────────────────────
node --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo         Download it from: https://nodejs.org  ^(choose the LTS version^)
  echo         Then re-run this script.
  echo.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo [OK] Node.js %%v found.

:: ── Step 2: Install / update Wrangler ─────────────────
echo.
echo [1/3] Installing Wrangler CLI...
call npm install -g wrangler 2>&1
if errorlevel 1 (
  echo [ERROR] Failed to install Wrangler. Check your internet connection.
  pause
  exit /b 1
)
echo [OK] Wrangler ready.

:: ── Step 3: Login ──────────────────────────────────────
echo.
echo [2/3] Logging into Cloudflare...
echo       A browser window will open. Log in and click "Authorize Wrangler".
echo.
call wrangler login
if errorlevel 1 (
  echo [ERROR] Cloudflare login failed.
  pause
  exit /b 1
)
echo [OK] Logged in to Cloudflare.

:: ── Step 4: Deploy ─────────────────────────────────────
echo.
echo [3/3] Deploying to Cloudflare Pages...
call wrangler pages deploy . --project-name=marsbase-voting
if errorlevel 1 (
  echo [ERROR] Deployment failed. See output above for details.
  pause
  exit /b 1
)

:: ── Done ───────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║  DEPLOYMENT COMPLETE!                                ║
echo  ║                                                      ║
echo  ║  Your app is live at:                                ║
echo  ║  https://marsbase-voting.pages.dev                   ║
echo  ║                                                      ║
echo  ║  TWO FINAL STEPS IN CLOUDFLARE DASHBOARD:           ║
echo  ║                                                      ║
echo  ║  1. Add Workers AI binding (free AI auto-caption):   ║
echo  ║     Pages - marsbase-voting - Settings               ║
echo  ║     Bindings - Add - Workers AI - name it: AI        ║
echo  ║     Then re-run: wrangler pages deploy .             ║
echo  ║                                                      ║
echo  ║  2. Add custom domain marsbase.win:                  ║
echo  ║     Pages - marsbase-voting - Settings               ║
echo  ║     Domains and Routes - Add Custom Domain           ║
echo  ║     Type: marsbase.win - click Continue              ║
echo  ║     (DNS is auto-configured, TLS takes ~60 seconds)  ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
pause
