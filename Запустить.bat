@echo off
chcp 65001 >nul
cd /d "%~dp0server"
if not exist node_modules (
  echo Pervyy zapusk: ustanavlivayu biblioteki...
  call npm install
)
if not exist .env (
  echo NET FAYL server\.env  Skopiruy .env.example v .env i vpihi parol PostgreSQL.
  pause
  exit /b 1
)
echo.
echo SavdoShop otkritsya na  http://localhost:3000
echo Ostanovit zapusk: Ctrl+C  ili zakroy okno.
echo.
call npm start
pause
