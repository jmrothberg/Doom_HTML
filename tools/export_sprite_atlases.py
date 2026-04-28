#!/usr/bin/env python3
"""
Slice 4x4 sprite atlases from assets/source/atlas_sheets/ into labeled PNGs under assets/sprites/.
Also writes assets/better/sprites.json (v2) with clip paths for the game loader.
Grid math matches js/spriteAtlas.js gridAxisSegment / getGridRect.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    from PIL import Image
    import numpy as np
except ImportError as e:
    raise SystemExit("Install Pillow and numpy: pip install Pillow numpy") from e


def grid_axis_segment(total_size: int, parts: int, index: int) -> tuple[int, int]:
    base = total_size // parts
    rem = total_size % parts
    offset = 0
    for i in range(index):
        offset += base + (1 if i < rem else 0)
    size = base + (1 if index < rem else 0)
    return offset, size


def get_grid_rect(img_w: int, img_h: int, cols: int, rows: int, cell_index: int) -> tuple[int, int, int, int]:
    col = cell_index % cols
    row = cell_index // cols
    x_seg = grid_axis_segment(img_w, cols, col)
    y_seg = grid_axis_segment(img_h, rows, row)
    return x_seg[0], y_seg[0], x_seg[1], y_seg[1]


def _dilate_bool(mask: np.ndarray, iterations: int = 1) -> np.ndarray:
    """Expand True regions (4-neighborhood), no wrap at borders."""
    m = mask.astype(bool)
    for _ in range(iterations):
        acc = m.copy()
        acc[1:, :] |= m[:-1, :]
        acc[:-1, :] |= m[1:, :]
        acc[:, 1:] |= m[:, :-1]
        acc[:, :-1] |= m[:, 1:]
        m = acc
    return m


def key_transparent_background(
    im: Image.Image,
    white_floor: int = 226,
    sheet_dist: float = 58.0,
    halo_passes: int = 2,
) -> Image.Image:
    """
    Remove sheet background and thin fringe/halos. Combines:
    - near-white pixels, corner-colored sheet, and low-saturation light neutrals
    - dilates the transparent mask a few pixels inward to drop chroma halos / stray dots
    """
    arr = np.array(im.convert("RGBA"))
    rgb = arr[:, :, :3].astype(np.float32)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    h, w = arr.shape[:2]

    white_mask = (r >= white_floor) & (g >= white_floor) & (b >= white_floor)

    cref = (
        rgb[0, 0] + rgb[0, w - 1] + rgb[h - 1, 0] + rgb[h - 1, w - 1]
    ) / 4.0
    dist = np.sqrt(np.sum((rgb - cref) ** 2, axis=2))
    sheet_mask = dist < sheet_dist

    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    lum = (r + g + b) / 3.0
    # Flat light gray / off-white sheet (low chroma, bright)
    neutral_light = (lum >= 200.0) & (sat < 38.0)

    transparent = white_mask | sheet_mask | neutral_light
    transparent = _dilate_bool(transparent, iterations=halo_passes)

    arr[:, :, 3] = np.where(transparent, 0, arr[:, :, 3])
    return Image.fromarray(arr)


def slice_atlas(
    src_path: Path,
    out_dir: Path,
    cols: int,
    rows: int,
    transparent_bg: bool,
    cell_inset_px: int,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    im = Image.open(src_path).convert("RGBA")
    img_w, img_h = im.size
    n = cols * rows
    for i in range(n):
        sx, sy, sw, sh = get_grid_rect(img_w, img_h, cols, rows, i)
        # Shrink crop inward so atlas grid lines / neighboring-cell ink are not included ("box" artifact)
        if cell_inset_px > 0:
            m = cell_inset_px
            sx += m
            sy += m
            sw -= 2 * m
            sh -= 2 * m
            if sw < 8 or sh < 8:
                sx -= m
                sy -= m
                sw += 2 * m
                sh += 2 * m
        cell = im.crop((sx, sy, sx + sw, sy + sh))
        if transparent_bg:
            cell = key_transparent_background(cell)
        name = f"frame_{i:02d}.png"
        cell.save(out_dir / name)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--opaque",
        action="store_true",
        help="Do not remove backgrounds (default: white/sheet -> transparent for all except environment/)",
    )
    parser.add_argument(
        "--inset",
        type=int,
        default=3,
        help="Pixels to trim from each cell edge before keying (drops sheet grid lines). Default 3. Use 0 to disable.",
    )
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    args = parser.parse_args()
    root: Path = args.root

    atlas_dir = root / "assets" / "source" / "atlas_sheets"
    sprites_root = root / "assets" / "sprites"

    mapping = {
        "monster1": atlas_dir / "C96AC1C0-EA26-4FDD-BD51-9147E5E06F7E.png",
        "monster2": atlas_dir / "E04677D4-57D1-4200-B2AF-55E2E575C316.png",
        "monster3": atlas_dir / "0659DA56-B41C-4973-8A3E-7DE4BB1CC929.png",
        "player": atlas_dir / "FB67B0FB-5C32-4D5A-9D19-BA186363502F.png",
        "pickups": atlas_dir / "A44ECC88-26D1-4A94-816B-3DE5D3409FEA.png",
        "environment": atlas_dir / "98A6C18E-E601-4CF3-B178-7D8E461C0886.png",
    }

    cols = rows = 4
    for key, src in mapping.items():
        if not src.exists():
            raise FileNotFoundError(src)
        dest = sprites_root / key
        # Wall tiles stay opaque so raycasting stays solid; everything else gets transparent BG
        use_transparent = (not args.opaque) and key != "environment"
        inset = 0 if key == "environment" else max(0, args.inset)
        slice_atlas(src, dest, cols, rows, use_transparent, inset)

    def frame_paths(prefix: str, indices: list[int]) -> list[str]:
        return [f"assets/sprites/{prefix}/frame_{i:02d}.png" for i in indices]

    # Clip definitions (indices match 4x4 row-major sheets)
    idle_idx = [0, 1]
    attack_idx = [2, 3]
    walk_idx = [4, 5, 6, 7, 8, 9, 10, 11]
    hurt_idx = [12]
    death_idx = [12, 13, 14, 15]

    clips: dict = {}
    for mk in ("monster1", "monster2", "monster3"):
        clips[mk] = {
            "idle": frame_paths(mk, idle_idx),
            "walk": frame_paths(mk, walk_idx),
            "attack": frame_paths(mk, attack_idx),
            "hurt": frame_paths(mk, hurt_idx),
            "death": frame_paths(mk, death_idx),
        }

    manifest = {
        "version": 2,
        "clips": clips,
        "player": {
            "walk": frame_paths("player", walk_idx),
        },
        "named": {
            "wallTile": "assets/sprites/environment/frame_09.png",
            "healthPickup": "assets/sprites/pickups/frame_00.png",
            "ammoPickup": "assets/sprites/pickups/frame_06.png",
        },
    }

    out_json = root / "assets" / "better" / "sprites.json"
    out_json.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {out_json}")
    print(f"Exported PNGs under {sprites_root}")


if __name__ == "__main__":
    main()
