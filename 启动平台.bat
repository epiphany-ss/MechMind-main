@echo off
chcp 65001 >nul
title 理论力学平台 - 一键启动
cd /d "%~dp0"
echo ============================================
echo   理论力学平台 - 一键启动
echo.
echo   [1] 题库服务器   http://localhost:8090
echo   [2] 平台服务器   http://localhost:8080
echo.
echo   点击本文件将同时启动【题库】和【平台】两个功能
echo   请保持两个黑色窗口打开（按 Ctrl+C 可停止）
echo ============================================
echo.
python launch_platform.py
pause
