"""DEAP → 六参数特征提取。

DEAP（Koelstra et al., 2012）预处理版结构：
    data   (40 trials, 40 channels, 8064 samples)  128 Hz，63 s
    labels (40 trials, 4)  valence, arousal, dominance, liking（1–9）
    通道 0–31 为 EEG；32 hEOG, 33 vEOG, 34 zEMG, 35 tEMG, 36 GSR, 37 Resp, 38 Pleth, 39 Temp

关键点：DEAP 的 EEG 通道顺序前 15 个为
    Fp1, AF3, F3, F7, FC5, T7, P7, O1, O2, P8, T8, FC6, F4, F8, AF4
与 Emotiv EPOC X 的 14 导（AF3 F7 F3 FC5 T7 P7 O1 O2 P8 T8 FC6 F4 F8 AF4）几乎一一对应。
因此这里只取这 14 导（跳过 Fp1），让离线特征管线与未来 EPOC X 在线管线同构，
换设备时只替换数据源，不改特征与映射。
"""

from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np
from scipy.signal import welch

FS = 128

# DEAP 通道下标（0-based），按 EPOC X 的 14 导排列
EPOC_X_CHANNELS = [
    ("AF3", 1),
    ("F3", 2),
    ("F7", 3),
    ("FC5", 4),
    ("T7", 5),
    ("P7", 6),
    ("O1", 7),
    ("O2", 8),
    ("P8", 9),
    ("T8", 10),
    ("FC6", 11),
    ("F4", 12),
    ("F8", 13),
    ("AF4", 14),
]
CH_IDX = [i for _, i in EPOC_X_CHANNELS]
CH_NAME = {name: n for n, (name, _) in enumerate(EPOC_X_CHANNELS)}  # 名称 → 通道内序号

BANDS = {"theta": (4, 8), "alpha": (8, 13), "beta": (13, 30), "gamma": (30, 45)}


def load_subject(path: str | Path) -> tuple[np.ndarray, np.ndarray]:
    """读取单个被试 .dat（python2 pickle，需 latin1）。"""
    with open(path, "rb") as f:
        d = pickle.load(f, encoding="latin1")
    data = np.asarray(d["data"], dtype=np.float64)[:, CH_IDX, :]
    labels = np.asarray(d["labels"], dtype=np.float64)
    return data, labels


def _band_power(freqs: np.ndarray, psd: np.ndarray, lo: float, hi: float) -> np.ndarray:
    m = (freqs >= lo) & (freqs < hi)
    return psd[:, m].sum(axis=1)


def frame_features(win: np.ndarray) -> dict:
    """单窗特征。win: (14, n_samples) 已按 EPOC X 通道排列。"""
    freqs, psd = welch(win, fs=FS, nperseg=min(256, win.shape[1]), axis=-1)
    bp = {k: _band_power(freqs, psd, lo, hi) for k, (lo, hi) in BANDS.items()}

    total = sum(bp.values()) + 1e-12
    rel = {k: float(v.mean() / total.mean()) for k, v in bp.items()}

    alpha_ch = bp["alpha"] + 1e-12
    theta_ch = bp["theta"] + 1e-12
    beta_ch = bp["beta"] + 1e-12

    # Pope 参与度指数，取额中央附近通道均值（FC5/FC6、F3/F4）
    eng_ch = beta_ch / (alpha_ch + theta_ch)
    engagement = float(np.mean([eng_ch[CH_NAME[c]] for c in ("FC5", "FC6", "F3", "F4")]))

    # 额区 alpha 不对称：ln(αF4) − ln(αF3)，正值偏趋近动机
    asym = float(np.log(alpha_ch[CH_NAME["F4"]]) - np.log(alpha_ch[CH_NAME["F3"]]))

    # 谱熵：4–45 Hz 归一化
    m = (freqs >= 4) & (freqs < 46)
    p = psd[:, m].mean(axis=0)
    p = p / (p.sum() + 1e-12)
    entropy = float(-(p * np.log(p + 1e-12)).sum() / np.log(len(p)))

    # 信号质量代理：DEAP 无阻抗记录，用伪迹比例估计（超 4 MAD 的样本占比）
    med = np.median(win, axis=1, keepdims=True)
    mad = np.median(np.abs(win - med), axis=1, keepdims=True) * 1.4826 + 1e-12
    artifact = float(np.mean(np.abs(win - med) > 4 * mad))
    quality = float(np.clip(1.0 - 4.0 * artifact, 0.2, 1.0))

    return {
        "theta": rel["theta"],
        "alpha": rel["alpha"],
        "beta": rel["beta"],
        "gamma": rel["gamma"],
        "engagement": engagement,
        "asym": asym,
        "entropy": entropy,
        "quality": quality,
    }


def trial_frames(trial: np.ndarray, win_s: float = 2.0, hop_s: float = 0.1) -> list[dict]:
    """单 trial → 按 0.1 s 步长的特征帧序列。"""
    n_win = int(win_s * FS)
    n_hop = int(hop_s * FS)
    out = []
    for start in range(0, trial.shape[1] - n_win + 1, n_hop):
        out.append(frame_features(trial[:, start : start + n_win]))
    return out


def _rank_norm(values: np.ndarray, lo_p: float = 5, hi_p: float = 95) -> np.ndarray:
    """会话内百分位归一：把 5–95 分位映射到 0–1，抗个体差异与量纲差异。"""
    lo, hi = np.percentile(values, lo_p), np.percentile(values, hi_p)
    if hi - lo < 1e-9:
        return np.full_like(values, 0.5)
    return np.clip((values - lo) / (hi - lo), 0.0, 1.0)


def to_states(frames: list[dict], smooth: int = 8) -> list[dict]:
    """特征帧序列 → 六参数序列（百分位归一 + 时序平滑）。"""
    if not frames:
        return []
    keys = ["theta", "alpha", "beta", "gamma", "engagement", "asym", "entropy"]
    arr = {k: np.array([f[k] for f in frames], dtype=float) for k in keys}

    # 唤醒度：β 相对功率 + 额区趋近动机的一半权重
    arousal = _rank_norm(arr["beta"] + 0.5 * np.clip(arr["asym"], -1, 1))
    engagement = _rank_norm(arr["engagement"])
    entropy = _rank_norm(arr["entropy"])

    # 稳定性：α 相对功率在近 8 帧内的波动越小越稳
    alpha = arr["alpha"]
    win = max(2, smooth)
    rolling_std = np.array(
        [alpha[max(0, i - win + 1) : i + 1].std() for i in range(len(alpha))]
    )
    # 起始不足一窗时 std 被低估，会误判为「极稳」，用第一个满窗值回填
    if len(rolling_std) > win:
        rolling_std[: win - 1] = rolling_std[win - 1]
    stability = 1.0 - _rank_norm(rolling_std)

    # 变化量：唤醒度的短时变化速度
    d_arousal = np.abs(np.diff(arousal, prepend=arousal[0]))
    change = _rank_norm(np.convolve(d_arousal, np.ones(5) / 5, mode="same"))

    states = []
    for i, f in enumerate(frames):
        states.append(
            {
                "quality": round(float(f["quality"]), 3),
                "activation": round(float(arousal[i]), 3),
                "stability": round(float(stability[i]), 3),
                "complexity": round(float(entropy[i]), 3),
                "change": round(float(change[i]), 3),
                "focus": round(float(engagement[i]), 3),
            }
        )

    # 时间平滑：百分位归一会把微小差异放大到满量程，直接用会显得跳动。
    # 对五个视觉参数做一阶指数平滑（change 保留更多响应），quality 不平滑。
    out = []
    prev = None
    for s in states:
        if prev is None:
            prev = dict(s)
            out.append(s)
            continue
        cur = dict(s)
        for k in ("activation", "stability", "complexity", "focus"):
            cur[k] = round(prev[k] + 0.3 * (s[k] - prev[k]), 3)
        cur["change"] = round(prev["change"] + 0.5 * (s["change"] - prev["change"]), 3)
        prev = cur
        out.append(cur)
    return out


def describe(path: str | Path) -> dict:
    data, labels = load_subject(path)
    return {
        "file": Path(path).name,
        "trials": data.shape[0],
        "channels": data.shape[1],
        "seconds": round(data.shape[2] / FS, 1),
        "labels": labels.shape,
        "valence_range": [round(float(labels[:, 0].min()), 2), round(float(labels[:, 0].max()), 2)],
        "arousal_range": [round(float(labels[:, 1].min()), 2), round(float(labels[:, 1].max()), 2)],
    }
