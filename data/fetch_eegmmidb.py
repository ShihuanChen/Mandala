"""Download PhysioNet EEGMMIDB subsets with resume support.

EEGMMIDB: 109 subjects, 14 one-minute runs each, 160 Hz, 64 channels.
  R01/R02  baseline eyes open / eyes closed
  R03/R04  motor execution (fists)
  R05/R06  motor execution (fists / feet)
  R07/R08  motor execution (fists / feet)
  R09/R10  motor imagery (fists / feet)
  R11/R12  motor imagery (fists / feet)
  R13/R14  motor execution (fists / feet)

Usage:
  python data/fetch_eegmmidb.py                       # S001-S012, all runs
  python data/fetch_eegmmidb.py --subjects 1-3 --runs 1-2
  python data/fetch_eegmmidb.py --subjects 1,5,9 --runs 1,2,13,14
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://physionet.org/files/eegmmidb/1.0.0"
ROOT = Path(__file__).resolve().parent / "eegmmidb"
UA = "Mozilla/5.0 (compatible; new-chinese-bci/0.1; academic research)"
EXTS = (".edf", ".event")


def parse_range(text: str) -> list[int]:
    """'1-3,7' -> [1,2,3,7]"""
    out: list[int] = []
    for part in text.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return sorted(set(out))


def fetch(url: str, dest: Path, retries: int = 4) -> bool:
    if dest.exists() and dest.stat().st_size > 0:
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=90) as r, open(tmp, "wb") as f:
                while chunk := r.read(1 << 16):
                    f.write(chunk)
            if tmp.stat().st_size == 0:
                raise IOError("empty file")
            tmp.replace(dest)
            return True
        except (urllib.error.URLError, urllib.error.HTTPError, IOError, TimeoutError) as e:
            tmp.unlink(missing_ok=True)
            if attempt == retries:
                print(f"  FAIL {url} :: {e}", flush=True)
                return False
            time.sleep(2 * attempt)
    return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--subjects", default="1-12", help="e.g. 1-12 or 1,5,9")
    ap.add_argument("--runs", default="1-14", help="e.g. 1-14 or 1,2,13,14")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    subs = parse_range(args.subjects)
    runs = parse_range(args.runs)
    ROOT.mkdir(parents=True, exist_ok=True)

    total = len(subs) * len(runs) * len(EXTS)
    done = 0
    ok = 0
    skipped = 0
    failed: list[str] = []
    t0 = time.time()

    for si, s in enumerate(subs, 1):
        sid = f"S{s:03d}"
        for r in runs:
            for ext in EXTS:
                name = f"{sid}R{r:02d}{ext}"
                dest = ROOT / sid / name
                url = f"{BASE}/{sid}/{name}"
                existed = dest.exists() and dest.stat().st_size > 0
                good = fetch(url, dest)
                done += 1
                if good:
                    ok += 1
                    if existed:
                        skipped += 1
                    if not args.quiet:
                        tag = "skip" if existed else "get "
                        print(f"[{done}/{total}] {tag} {name}", flush=True)
                else:
                    failed.append(name)
                    print(f"[{done}/{total}] MISS {name}", flush=True)
        if not args.quiet:
            print(f"-- subject {sid} done ({si}/{len(subs)})", flush=True)

    manifest = {
        "dataset": "PhysioNet EEGMMIDB 1.0.0",
        "source": BASE,
        "subjects": [f"S{s:03d}" for s in subs],
        "runs": runs,
        "files_ok": ok,
        "files_skipped": skipped,
        "failed": failed,
        "seconds": round(time.time() - t0, 1),
    }
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    size_mb = sum(f.stat().st_size for f in ROOT.rglob("*") if f.is_file()) / 1e6
    print(f"\ndone: ok={ok} skipped={skipped} failed={len(failed)} size={size_mb:.1f} MB")
    if failed:
        print("retry by re-running the same command (existing files are skipped)")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
