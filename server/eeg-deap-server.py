#!/usr/bin/env python3
"""DEAP 回放服务：真实 EEG 数据集驱动六参数，替代尚未到手的 EPOC X。

输出与模拟服务完全一致（同一端口、同一消息格式），网页端不需要任何改动：

  {"type":"state","version":"0.1","timestamp":...,"quality":...,
   "activation":...,"stability":...,"complexity":...,"change":...,"focus":...,
   "source":"deap","subject":1,"trial":3}

换成 EPOC X 时，只要另写一个把 Cortex 数据算成同样六参数的 handler，
前端与视觉层不动。

用法：
  python server/eeg-deap-server.py --list
  python server/eeg-deap-server.py --subject 1 --trial 0
  python server/eeg-deap-server.py --subject 1 --speed 2 --loop
  python server/eeg-deap-server.py --subject 1 --dump data/deap_s01_states.csv
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import sys
import time
from pathlib import Path

import numpy as np
import websockets
from websockets.exceptions import ConnectionClosed

sys.path.insert(0, str(Path(__file__).resolve().parent))
from eeg_features import load_subject, to_states, trial_frames  # noqa: E402

HOST = "127.0.0.1"
PORT = 8765
FRAME_HZ = 10
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "deap" / "data_preprocessed_python"

CURRENT: dict = {"type": "state", "version": "0.1", "source": "deap", "quality": 0.5,
                 "activation": 0.5, "stability": 0.5, "complexity": 0.5,
                 "change": 0.0, "focus": 0.5, "timestamp": time.time()}


def subject_path(n: int) -> Path:
    return DATA_DIR / f"s{n:02d}.dat"


def build_states(n: int, trials: list[int]) -> dict[int, list[dict]]:
    path = subject_path(n)
    if not path.exists():
        raise SystemExit(
            f"缺少 {path}\n先运行：python data/fetch_deap.py --extract"
        )
    data, _ = load_subject(path)
    out = {}
    for t in trials:
        frames = trial_frames(data[t])
        states = to_states(frames)
        out[t] = states
        print(f"[deap] subject s{n:02d} trial {t:02d}: {len(states)} frames "
              f"({len(states) / FRAME_HZ:.0f}s realtime)", flush=True)
    return out


async def producer(all_states: dict[int, list[dict]], speed: float, loop: bool) -> None:
    order = sorted(all_states)
    while True:
        for t in order:
            for st in all_states[t]:
                CURRENT.update(st)
                CURRENT["trial"] = t
                CURRENT["timestamp"] = round(time.time(), 3)
                await asyncio.sleep(1.0 / (FRAME_HZ * speed))
        if not loop:
            print("[deap] 一轮播放结束，保持末帧状态。加 --loop 可循环。", flush=True)
            return


async def handler(ws):
    print(f"[ws] client connected: {ws.remote_address}", flush=True)
    try:
        while True:
            await ws.send(json.dumps(CURRENT, ensure_ascii=False))
            await asyncio.sleep(1.0 / FRAME_HZ)
    except ConnectionClosed:
        print("[ws] client disconnected", flush=True)


async def main_async(args) -> None:
    trials = [int(x) for x in args.trial.split(",")] if args.trial else [0]
    all_states = build_states(args.subject, trials)

    if args.dump:
        out = Path(args.dump)
        out.parent.mkdir(parents=True, exist_ok=True)
        keys = ["trial", "quality", "activation", "stability", "complexity", "change", "focus"]
        with out.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=keys)
            w.writeheader()
            for t in sorted(all_states):
                for st in all_states[t]:
                    w.writerow({"trial": t, **{k: st[k] for k in keys[1:]}})
        print(f"[deap] 已导出 {out}", flush=True)

    async with websockets.serve(handler, HOST, args.port):
        print(f"[ws] listening on ws://{HOST}:{args.port}  (source=deap, s{args.subject:02d}, "
              f"trials={trials}, speed={args.speed}x)", flush=True)
        print("[ws] 网页左侧切到「实时」即可接收。", flush=True)
        if args.serve_only:
            await asyncio.Future()
        else:
            await asyncio.gather(producer(all_states, args.speed, args.loop),
                                 asyncio.Future())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--subject", type=int, default=1, help="1–32")
    ap.add_argument("--trial", default="0", help="0–39，可逗号分隔")
    ap.add_argument("--speed", type=float, default=1.0, help="播放倍速")
    ap.add_argument("--loop", action="store_true", help="循环播放")
    ap.add_argument("--port", type=int, default=PORT)
    ap.add_argument("--dump", default="", help="把状态序列导出为 CSV")
    ap.add_argument("--serve-only", action="store_true", help="不播放，只用一个静态状态挂住连接")
    ap.add_argument("--list", action="store_true", help="列出本地已下载的被试")
    args = ap.parse_args()

    if args.list:
        files = sorted(DATA_DIR.glob("s*.dat"))
        if not files:
            print(f"未找到数据：{DATA_DIR}")
            print("先运行：python data/fetch_deap.py --extract")
            return
        for f in files:
            print(f"  {f.name}  {f.stat().st_size / 1e6:.1f} MB")
        return

    try:
        asyncio.run(main_async(args))
    except KeyboardInterrupt:
        print("\n[ws] stopped")


if __name__ == "__main__":
    main()
