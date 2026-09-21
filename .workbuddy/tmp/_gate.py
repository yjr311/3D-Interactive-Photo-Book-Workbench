# -*- coding: utf-8 -*-
"""总闸门：顺序跑完 10 个套件，汇总 PASS/FAIL。

为什么不用 bash 循环：Windows 的 Git Bash 会把 `!` 吃掉、也会把
`CHROME_PATH=C:/...` 里的路径当参数传歪；用 Python 起子进程最稳。
另外每个套件都独占一个 CDP 端口，**必须顺序跑**（并行会互相抢端口）。

⚠ 有一条"零断言"的重试：套件起来时 `launch()` 偶发拿不到
`webSocketDebuggerUrl`（上一个 Chromium 还没退干净，实测 test_note 撞过一次，
单跑就是 31/31 全绿）。它的特征是 **PASS 0 / FAIL 0 / exit≠0** ——
不是"断言失败"，是"套件根本没跑起来"，重跑一次；重试必须**打印出来**，
不能把真崩溃悄悄吞掉（真崩溃同样是 0/0，重试后还是 BAD）。
"""
import os, re, subprocess, sys, time

ROOT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14"
TMP = os.path.join(ROOT, ".workbuddy/tmp")
NODE = r"C:/Users/zz/.workbuddy/binaries/node/versions/22.22.2-2/node.exe"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"

SUITES = [
    "test_book", "test_flow", "test_landing", "test_real",
    "test_skin", "test_note", "test_export", "test_auto", "test_mat",
    "test_batch2",
]

env = dict(os.environ)
env["CHROME_PATH"] = CHROME
env["NODE_PATH"] = r"C:/Users/zz/.workbuddy/binaries/node/workspace/node_modules"

total_ok = total_bad = 0
report = []
failed_suites = []


def run_suite(path):
    t0 = time.time()
    try:
        r = subprocess.run([NODE, path], cwd=TMP, env=env,
                           capture_output=True, timeout=900)
        out = (r.stdout or b"").decode("utf-8", "replace")
        err = (r.stderr or b"").decode("utf-8", "replace")
        rc = r.returncode
    except subprocess.TimeoutExpired:
        out, err, rc = "", "TIMEOUT > 900s", None
    return out, err, rc, time.time() - t0


for name in SUITES:
    path = os.path.join(TMP, name + ".mjs")
    out, err, rc, dt = run_suite(path)
    nok = len(re.findall(r"^PASS ", out, re.M))
    nbad = len(re.findall(r"^FAIL ", out, re.M))

    # 零断言 + 非零退出 = 没起来，不是失败
    if nok == 0 and nbad == 0 and rc != 0:
        print(f"[retry] {name}: 0 项断言 / exit={rc} —— 套件没起来，重跑一次")
        sys.stdout.flush()
        time.sleep(2.0)
        out, err, rc, dt = run_suite(path)
        nok = len(re.findall(r"^PASS ", out, re.M))
        nbad = len(re.findall(r"^FAIL ", out, re.M))
        print(f"[retry] {name}: 重跑得到 {nok} ok / {nbad} fail / exit={rc}")

    total_ok += nok
    total_bad += nbad
    tag = "OK  " if (nbad == 0 and rc == 0) else "BAD "
    if tag.startswith("BAD"):
        failed_suites.append(name)
    report.append(f"{tag}{name:14s} {nok:3d} ok / {nbad:3d} fail   {dt:6.1f}s  exit={rc if rc is not None else '--'}")

    if nbad or rc is None or rc != 0:
        print("-" * 70)
        print(f"### {name} 失败明细")
        for line in out.splitlines():
            if line.startswith("FAIL ") or line.startswith("SETUP") or "Error" in line:
                print("   ", line[:220])
        if err.strip():
            print("   stderr:", err.strip()[:600])
        print("-" * 70)
    sys.stdout.flush()
    time.sleep(1.0)          # 让上一个 Chromium 退干净再起下一个

print()
print("=" * 70)
for line in report:
    print(line)
print("=" * 70)
print(f"合计 PASS {total_ok} / FAIL {total_bad}")
print("未过的套件:", ", ".join(failed_suites) if failed_suites else "无")
sys.exit(0 if total_bad == 0 and not failed_suites else 1)

