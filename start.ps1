# PayRecover AI - Quick Start Script
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PayRecover AI - Razorpay AI Buildathon" -ForegroundColor Cyan
Write-Host "  Track 3: AI Revenue Recovery" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start backend
Write-Host "[1/2] Starting backend server (port 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; Write-Host 'PayRecover AI Backend' -ForegroundColor Cyan; node src/server.js" -PassThru | Out-Null

Start-Sleep -Seconds 2

# Start frontend
Write-Host "[2/2] Starting frontend dev server (port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; Write-Host 'PayRecover AI Frontend' -ForegroundColor Cyan; node_modules\.bin\vite" -PassThru | Out-Null

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "✅ PayRecover AI is starting!" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor White
Write-Host "  API:      http://localhost:3001/api/payments" -ForegroundColor White
Write-Host ""
Write-Host "  Set your OpenAI API key in backend/.env to enable GPT analysis." -ForegroundColor Gray
Write-Host "  The app works fully without it using fallback rule-based analysis." -ForegroundColor Gray
Write-Host ""
