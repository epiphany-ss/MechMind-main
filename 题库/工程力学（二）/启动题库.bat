@echo off
title 工程力学题库服务器
cd /d "%~dp0"
echo ============================================
echo   工程力学题库 - 正在启动服务器...
echo   按 Ctrl+C 停止服务器
echo ============================================
echo.
start "题库服务器" python server.py
ping -n 5 127.0.0.1 >nul
start "" http://localhost:8090
