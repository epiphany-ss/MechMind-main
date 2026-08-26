# -*- coding: utf-8 -*-
"""一键启动器：
- 题库服务器   http://localhost:8090   （题库/工程力学（二）/server.py）
- 平台服务器   http://localhost:8080   （server.py，主界面 index.html）
点击启动后【只打开主界面】本地文件 index.html（新副本）；
题库(8090)服务器在后台运行但不自动弹出页面，点击主界面「理论力学题库」即可进入。
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

    # 题库：仅启动 8090 服务器（不再自动打开题库页面；主界面「理论力学题库」链接会按需打开）
    print('[*] 正在启动题库服务器 (8090) …')
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

    # 启动后连接 index.html（主界面）
    # 优先通过 8080 服务器打开（http://localhost:8080/index.html），保证登录状态（localStorage）
    # 与各页面同源一致，避免 file:// 与 http:// 混用时登录状态丢失的问题。
    if ok_8080:
        main_url = 'http://localhost:8080/index.html'
        print('[*] 连接主界面: %s' % main_url)
        webbrowser.open(main_url)
    else:
        # 服务器未就绪的兜底：直接打开本地 index.html 文件
        local_url = 'file:///' + os.path.join(BASE, 'index.html').replace('\\', '/')
        print('[!] 服务器未就绪，改为直接打开本地文件: %s' % local_url)
        webbrowser.open(local_url)

    print('[*] 完成。只打开主界面；需要题库时点击主界面的「理论力学题库」即可。')
    try:
        input('按回车键可关闭本窗口（服务器仍继续运行）…')
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
