# -*- coding: utf-8 -*-
"""一键启动器：
- 题库服务器   http://localhost:8090   （题库/工程力学（二）/server.py）
- 平台服务器   http://localhost:8080   （server.py）
- 自动打开浏览器
两个服务器分别在独立黑色窗口中运行，关闭本窗口不影响它们。
"""
import os
import subprocess
import sys
import time
import webbrowser

BASE = os.path.dirname(os.path.abspath(__file__))
QB_DIR = os.path.join(BASE, '题库', '工程力学（二）')
CONSOLE = getattr(subprocess, 'CREATE_NEW_CONSOLE', 0)


def main():
    print('[*] 正在启动题库服务器 (8090) …')
    subprocess.Popen([sys.executable, 'server.py'], cwd=QB_DIR, creationflags=CONSOLE)
    print('[*] 正在启动平台服务器 (8080) …')
    subprocess.Popen([sys.executable, 'server.py'], cwd=BASE, creationflags=CONSOLE)

    print('[*] 等待服务器就绪 …')
    time.sleep(3)

    print('[*] 打开题库页面: http://localhost:8090')
    webbrowser.open('http://localhost:8090')
    print('[*] 打开个人知识网络页面: C:/Users/Lenovo/Desktop/MechMind-main/personal_knowledge.html?v=20260826b')
    webbrowser.open('file:///C:/Users/Lenovo/Desktop/MechMind-main/personal_knowledge.html?v=20260826b')

    print('[*] 完成。请保留两个服务器黑色窗口（8090 题库 / 8080 平台）。')
    try:
        input('按回车键可关闭本窗口（服务器仍继续运行）…')
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
