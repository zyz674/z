@echo off
chcp 65001 >nul
title Neon Breakout - 霓虹突围
cd /d "%~dp0"

rem 检查开发服务器是否已经在 5173 端口运行
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo 游戏服务器已在运行，直接打开浏览器...
  start "" "http://localhost:5173/"
  exit /b 0
)

echo 正在启动 霓虹突围 ...
start "Neon Breakout Server" cmd /k "npm run dev"
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173/"
exit /b 0
