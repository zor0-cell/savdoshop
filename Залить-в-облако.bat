@echo off
chcp 65001 >nul
cd /d "%~dp0server"
echo Заливка проекта в облако (Supabase + MongoDB Atlas).
echo Если cloud.env ещё нет - он создастся шаблоном, заполни его и запусти этот файл снова.
echo.
node cloudprepare.mjs %*
echo.
pause
