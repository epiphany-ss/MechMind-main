@echo off
title 理论力学平台 - 一键启动
cd /d "%~dp0"
echo ============================================
echo   理论力学平台 - 一键启动
echo.
echo   点击本文件将同时运行：
echo.
echo   [1] 题库     通过 启动题库.bat 启动（8090端口）
echo   [2] 主界面   直接打开本地文件 index.html
echo.
echo   会自动先关闭残留的旧服务器，确保显示最新内容
echo ============================================
echo.
python launch_platform.py
pause
