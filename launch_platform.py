# -*- coding: utf-8 -*-
"""一键启动器：
- 题库服务器   http://localhost:8090   （题库/工程力学（二）/server.py）
- 平台服务器   http://localhost:8080   （server.py，主界面 index.html）
点击启动后【同时连接】两部分：题库(8090) + 主界面 本地文件 index.html（新副本）。
两个服务器分别在独立黑色窗口中运行，关闭本窗口不影响它们。

【永久性修正】启动前自动结束 8080 / 8090 端口上残留的旧服务器进程，
确保打开的一定是本目录的最新内容，避免「个人账户」「版本迭代」等
旧副本的服务器占用端口、导致显示旧页面。
"""
import os
import socket
import subprocess
import sys
import time
import webbrowser

BASE = os.path.dirname(os.path.abspath(__file__))
QB_DIR = os.path.join(BASE, '题库', '工程力学（二）')
CONSOLE = getattr(subprocess, 'CREATE_NEW_CONSOLE', 0)


def find_pids_on_port(port):
    """返回正在 LISTENING 指定端口的进程 PID 列表（无则空）。"""
    pids = set()
    try:
        out = subprocess.check_output(
            ['netstat', '-ano'], stderr=subprocess.DEVNULL, text=True, errors='ignore')
    except Exception:
        return []
    for line in out.splitlines():
        # 形如: TCP    127.0.0.1:8080   0.0.0.0:0   LISTENING  1234
        parts = line.split()
        if len(parts) >= 5 and parts[0].upper() == 'TCP' and 'LISTENING' in line.upper():
            if parts[1].endswith(':%d' % port):
                try:
                    pids.add(int(parts[-1]))
                except ValueError:
                    pass
    return pids


def kill_port(port):
    """结束占用该端口的旧服务器进程，确保加载最新内容。"""
    for pid in find_pids_on_port(port):
        try:
            subprocess.run(['taskkill', '/F', '/PID', str(pid)],
                           capture_output=True, text=True, timeout=5)
            print('[*] 已结束端口 %d 上残留的旧进程 (PID %d)' % (port, pid))
        except Exception as e:
            print('[!] 结束端口 %d 旧进程失败: %s' % (port, e))


def wait_port(port, timeout=8):
    """等待端口可连接（服务器已就绪）。"""
    end = time.time() + timeout
    while time.time() < end:
        try:
            with socket.create_connection(('127.0.0.1', port), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.3)
    return False


def main():
    print('[*] 检查 8080 / 8090 端口，结束残留的旧服务器进程 …')
    kill_port(8080)
    kill_port(8090)
    time.sleep(0.3)

    # 题库：调用题库专用的「启动题库.bat」（负责启动题库服务器并打开题库页面）
    qb_bat = os.path.join(QB_DIR, '启动题库.bat')
    print('[*] 正在通过 启动题库.bat 启动题库 (8090) …')
    try:
        os.startfile(qb_bat)
    except Exception as e:
        print('[!] 启动题库.bat 调用失败，改为直接启动题库服务器: %s' % e)
        subprocess.Popen([sys.executable, 'server.py'], cwd=QB_DIR, creationflags=CONSOLE)
    print('[*] 正在启动平台服务器 (8080) …')
    subprocess.Popen([sys.executable, 'server.py'], cwd=BASE, creationflags=CONSOLE)

    print('[*] 等待服务器就绪 …')
    ok_8090 = wait_port(8090)
    ok_8080 = wait_port(8080)
    if not ok_8090:
        print('[!] 题库服务器(8090)未能启动，请查看对应黑色窗口的错误信息。')
    if not ok_8080:
        print('[!] 平台服务器(8080)未能启动：端口可能被其他程序占用，')
        print('    请先在任务管理器中结束占用 8080 的进程，再重新点击本启动器。')

    # 打开主界面 index.html（题库页面已由「启动题库.bat」自动打开）
    # 主界面直接指向新副本的本地文件
    main_index = r'C:/Users/Lenovo/Desktop/MechMind-mainzx0/MechMind-mainzx/index.html'
    print('[*] 打开主界面: %s' % main_index)
    webbrowser.open('file:///' + main_index)

    print('[*] 完成。请保留两个服务器黑色窗口（8090 题库 / 8080 平台）。')
    try:
        input('按回车键可关闭本窗口（服务器仍继续运行）…')
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
