#!/usr/bin/env python3
"""模拟状态 WebSocket 服务。

用途：网页「实时」模式的联调入口。先推模拟状态，再接 EPOC X / PM。
消息格式与 src/state.js、交接文档 §3.3 一致：

  {"type":"state","version":"0.1","timestamp":...,"quality":...,
   "activation":...,"stability":...,"complexity":...,"change":...,"focus":...,
   "source":"simulation"}

运行：
  pip install -r requirements.txt
  python websocket-server.py

接入 EPOC X 时，只需把 make_state() 换成 Cortex / PM 的读数，
并把 source 改成 "emotiv_pm" 或 "emotiv_raw"。网页端不用改。
"""

import asyncio
import json
import math
import time

import websockets

HOST = "127.0.0.1"
PORT = 8765
RATE_HZ = 10

PRESETS = {
    "calm": dict(activation=0.28, stability=0.88, complexity=0.34, change=0.07, focus=0.62),
    "active": dict(activation=0.82, stability=0.56, complexity=0.64, change=0.38, focus=0.55),
    "focused": dict(activation=0.55, stability=0.90, complexity=0.40, change=0.09, focus=0.92),
    "unstable": dict(activation=0.70, stability=0.32, complexity=0.68, change=0.78, focus=0.40),
}
PRESET = "calm"


def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def make_state(t: float) -> dict:
    """模拟一段缓慢变化的脑机状态。"""
    p = PRESETS[PRESET]
    activation = clamp(p["activation"] + 0.09 * math.sin(t * 0.45 + 0.3))
    stability = clamp(p["stability"] + 0.05 * math.cos(t * 0.12 + 1.1))
    complexity = clamp(p["complexity"] + 0.07 * math.sin(t * 0.23 + 2.0))
    focus = clamp(p["focus"] + 0.05 * math.sin(t * 0.31 + 0.7))
    change = clamp(p["change"] * 0.85)
    quality = clamp(0.94 - 0.05 * (0.5 + 0.5 * math.sin(t * 0.17 + 2.4)))
    return {
        "type": "state",
        "version": "0.1",
        "timestamp": round(time.time(), 3),
        "quality": round(quality, 3),
        "activation": round(activation, 3),
        "stability": round(stability, 3),
        "complexity": round(complexity, 3),
        "change": round(change, 3),
        "focus": round(focus, 3),
        "source": "simulation",
    }


async def handler(ws):
    print(f"[ws] client connected: {ws.remote_address}")
    t0 = time.time()
    try:
        while True:
            await ws.send(json.dumps(make_state(time.time() - t0), ensure_ascii=False))
            await asyncio.sleep(1.0 / RATE_HZ)
    except websockets.ConnectionClosed:
        print("[ws] client disconnected")


async def main():
    async with websockets.serve(handler, HOST, PORT):
        print(f"[ws] listening on ws://{HOST}:{PORT}  ({RATE_HZ} Hz, preset={PRESET})")
        print("[ws] 在网页左侧切到「实时」即可接收。")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
