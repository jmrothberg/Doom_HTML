#!/usr/bin/env python3
"""
Convert assets/source/weapon_jpegs/*.jpg to transparent PNGs in assets/weapons/doom/
Black (and near-black) backgrounds -> alpha 0. Run: python3 tools/process_doom_weapon_jpegs.py
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image
import numpy as np

# Game keys -> three frames: idle, firing, recovery/cock
WEAPON_FILES = {
    "pistol": [
        "pistol_idle.jpg",
        "pistol_firing.jpg",
        "pistol_reload_or_cock.jpg",
    ],
    "machinegun": [
        "chaingun_idle.jpg",
        "chaingun_firing.jpg",
        "chaingun_reload_or_cock.jpg",
    ],
    "plasma": [
        "plasma_gun_idle.jpg",
        "plasma_gun_firing_or_impact.jpg",
        "plasma_gun_ready_or_recovery.jpg",
    ],
}


def key_black_transparent(im: Image.Image) -> Image.Image:
    """
    Remove black JPEG background only — does NOT erode real weapon art.

    Old approach (bright lum threshold + dilation) ate dark metal, shadows, and outlines.

    Rules:
    - "Pure black" band: max channel low (background + compression black).
    - Optional dark neutral fringe: low saturation only (sheet is gray/black, guns keep color).
    No dilation — that was bleeding transparency into the sprite.
    """
    arr = np.array(im.convert("RGBA"))
    rgb = arr[:, :, :3].astype(np.float32)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    lum = (r + g + b) / 3.0
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn

    # Hard black / near-black (typical flat BG)
    pure_bg = (mx <= 28.0) & (lum <= 30.0)

    # JPEG fringe: still dark, but nearly neutral (weapon pixels stay saturated or brighter)
    neutral_fringe = (mx <= 52.0) & (lum <= 48.0) & (sat <= 18.0)

    transparent = pure_bg | neutral_fringe
    arr[:, :, 3] = np.where(transparent, 0, arr[:, :, 3])
    return Image.fromarray(arr)


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    src_dir = root / "assets" / "source" / "weapon_jpegs"
    out_dir = root / "assets" / "weapons" / "doom"
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest: dict[str, list[str]] = {}
    for weapon_key, files in WEAPON_FILES.items():
        paths_out: list[str] = []
        for i, fname in enumerate(files):
            src = src_dir / fname
            if not src.exists():
                raise FileNotFoundError(src)
            im = Image.open(src)
            im = key_black_transparent(im)
            out_name = f"{weapon_key}_{i}.png"
            out_path = out_dir / out_name
            im.save(out_path)
            paths_out.append(f"assets/weapons/doom/{out_name}")
        manifest[weapon_key] = paths_out

    meta_path = root / "assets" / "weapons" / "doom" / "frames.json"
    meta_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote transparent PNGs under {out_dir}")
    print(f"Wrote {meta_path}")


if __name__ == "__main__":
    main()
