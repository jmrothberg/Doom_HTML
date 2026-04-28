#!/usr/bin/env python3
"""
Slice BEDB6217 (9 weapons x 3 frames) into assets/weapons/hud_atlas/<name>_{0,1,2}.png
Layout: top 512px = 5 columns x 3 rows; bottom 512px = 4 columns x 3 rows.
Weapon order: pistol, shotgun, super_shotgun, chaingun, rocket | plasma, bfg, chainsaw, fist

Pixels are left untouched — only rectangular crops (source atlas is already RGBA transparent).
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image


def seg(total: int, parts: int, index: int) -> tuple[int, int]:
    base = total // parts
    rem = total % parts
    offset = 0
    for i in range(index):
        offset += base + (1 if i < rem else 0)
    size = base + (1 if index < rem else 0)
    return offset, size


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    atlas_path = root / "BEDB6217-4B76-4BEB-BF65-39C450F247F0.png"
    if not atlas_path.exists():
        raise FileNotFoundError(atlas_path)

    out_dir = root / "assets" / "weapons" / "hud_atlas"
    out_dir.mkdir(parents=True, exist_ok=True)

    im = Image.open(atlas_path)
    w, h = im.size
    if (w, h) != (1536, 1024):
        print(f"Warning: expected 1536x1024, got {w}x{h}; slice math may need adjustment")

    half = h // 2  # 512
    rows = 3

    top_names = ["pistol", "shotgun", "super_shotgun", "chaingun", "rocket"]
    bot_names = ["plasma", "bfg", "chainsaw", "fist"]

    def slice_block(y0: int, y1: int, ncols: int, names: list[str]) -> None:
        bh = y1 - y0
        for ci, name in enumerate(names):
            sx, sw = seg(w, ncols, ci)
            for ri in range(rows):
                sy, sh = seg(bh, rows, ri)
                sy_abs = y0 + sy
                cell = im.crop((sx, sy_abs, sx + sw, sy_abs + sh))
                out_name = f"{name}_{ri}.png"
                cell.save(out_dir / out_name)

    slice_block(0, half, 5, top_names)
    slice_block(half, h, 4, bot_names)

    print(f"Wrote 27 PNGs to {out_dir}")


if __name__ == "__main__":
    main()
