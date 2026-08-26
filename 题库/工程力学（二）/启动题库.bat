@echo off
chcp 65001 >nul
title 工程力学题库服务器
cd /d "%~dp0"
echo ============================================
echo   工程力学题库 - 正在启动服务器...
echo   启动后请打开浏览器访问: http://localhost:8090
echo   按 Ctrl+C 停止服务器
echo ============================================
echo.
start "" http://localhost:8090
python server.py
pause
