"""下载并解压 DEAP 预处理版（ModelScope 镜像）。

为什么用 DEAP：
  - 32 导 EEG，前 15 导通道顺序与 EPOC X 的 14 导几乎一一对应，特征管线可直接迁移；
  - 每个 trial 附带 valence / arousal / dominance / liking 评分，可用来验证
    「六参数是否真的跟着情绪维度动」，这是纯模拟数据做不到的；
  - 国内 ModelScope 镜像可达（physionet.org 在本机被限速到 ~0.8 KB/s，不可用）。

来源：https://modelscope.cn/datasets/byzhrichard/DEAP
许可：DEAP 仅限非商业科研使用，引用 Koelstra et al. (2012), IEEE T-AFFC。

用法：
  python data/fetch_deap.py              # 下载 + 解压
  python data/fetch_deap.py --extract    # 只解压
"""

from __future__ import annotations

import argparse
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "deap"
URL = ("https://modelscope.cn/api/v1/datasets/byzhrichard/DEAP/repo"
       "?Revision=master&FilePath=data_preprocessed_python.zip")
ZIP = ROOT / "data_preprocessed_python.zip"
EXPECTED = 2_915_493_601
UA = "Mozilla/5.0 (compatible; new-chinese-bci/0.1; academic research)"
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def download() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    have = ZIP.stat().st_size if ZIP.exists() else 0
    if have >= EXPECTED:
        print(f"已存在完整压缩包：{ZIP} ({have/1e9:.2f} GB)")
        return

    headers = {"User-Agent": UA}
    if have:
        headers["Range"] = f"bytes={have}-"
        print(f"断点续传，从 {have/1e6:.0f} MB 继续")
    req = urllib.request.Request(URL, headers=headers)
    t0 = time.time()
    with OPENER.open(req, timeout=60) as r, open(ZIP, "ab" if have else "wb") as f:
        total = int(r.headers.get("Content-Length") or 0) + have
        done = have
        last = 0.0
        while chunk := r.read(1 << 20):
            f.write(chunk)
            done += len(chunk)
            if time.time() - last > 3:
                last = time.time()
                sp = done / max(time.time() - t0, 1e-6) / 1e6
                pct = 100 * done / total if total else 0
                print(f"  {done/1e6:7.0f} MB / {total/1e6:.0f} MB  "
                      f"({pct:5.1f}%)  {sp:.1f} MB/s", flush=True)
    print(f"下载完成：{ZIP.stat().st_size/1e9:.2f} GB，用时 {time.time()-t0:.0f}s")


def extract() -> None:
    if not ZIP.exists():
        raise SystemExit(f"缺少 {ZIP}，先运行不带 --extract 的命令")
    out = ROOT
    print(f"解压到 {out} ...")
    with zipfile.ZipFile(ZIP) as z:
        names = [n for n in z.namelist() if n.endswith(".dat")]
        z.extractall(out, members=[m for m in z.infolist() if m.filename in names])
    dat_dir = next(out.glob("data_preprocessed_python"))
    files = sorted(dat_dir.glob("s*.dat"))
    print(f"完成：{len(files)} 个被试文件在 {dat_dir}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--extract", action="store_true")
    ap.add_argument("--keep-zip", action="store_true", help="解压后保留压缩包")
    args = ap.parse_args()

    if not args.extract:
        download()
    extract()
    if not args.keep_zip and ZIP.exists():
        ZIP.unlink()
        print("已删除压缩包（--keep-zip 可保留）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
