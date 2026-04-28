/**
 * Sprite atlas helpers: slice uniform grids where total size may not divide evenly.
 * Used by assetLoader + Game when drawing from PNG atlases (see assets/better/sprites.json).
 */

/**
 * @param {number} totalSize
 * @param {number} parts
 * @param {number} index
 * @returns {{ offset: number, size: number }}
 */
export function gridAxisSegment(totalSize, parts, index) {
    const base = Math.floor(totalSize / parts);
    const rem = totalSize % parts;
    let offset = 0;
    for (let i = 0; i < index; i++) {
        offset += base + (i < rem ? 1 : 0);
    }
    const size = base + (index < rem ? 1 : 0);
    return { offset, size };
}

/**
 * @param {HTMLImageElement} img
 * @param {number} cols
 * @param {number} rows
 * @param {number} index - 0-based cell index (row-major)
 * @returns {{ sx: number, sy: number, sw: number, sh: number }}
 */
export function getGridRect(img, cols, rows, index) {
    const totalW = img.naturalWidth || img.width;
    const totalH = img.naturalHeight || img.height;
    const col = index % cols;
    const row = Math.floor(index / cols);
    const xSeg = gridAxisSegment(totalW, cols, col);
    const ySeg = gridAxisSegment(totalH, rows, row);
    return {
        sx: xSeg.offset,
        sy: ySeg.offset,
        sw: xSeg.size,
        sh: ySeg.size
    };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource} img
 * @param {{ sx: number, sy: number, sw: number, sh: number }} rect
 * @param {number} dx
 * @param {number} dy
 * @param {number} dw
 * @param {number} dh
 */
export function drawSpriteFrame(ctx, img, rect, dx, dy, dw, dh) {
    if (!img || !rect || rect.sw <= 0 || rect.sh <= 0) return;
    ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, dx, dy, dw, dh);
}

/**
 * Copy one atlas cell to a canvas (no transparency processing).
 * @param {CanvasImageSource} sourceImg
 * @param {{ sx: number, sy: number, sw: number, sh: number }} rect
 * @returns {HTMLCanvasElement}
 */
export function extractCellOpaque(sourceImg, rect) {
    const w = Math.max(1, Math.floor(rect.sw));
    const h = Math.max(1, Math.floor(rect.sh));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(sourceImg, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, w, h);
    return canvas;
}

/**
 * Slice one cell and remove flat sheet background via chroma key (avg of corner pixels as reference).
 * Each cell becomes its own bitmap — equivalent to loading separate transparent PNGs at runtime.
 * @param {CanvasImageSource} sourceImg
 * @param {{ sx: number, sy: number, sw: number, sh: number }} rect
 * @param {{ threshold?: number }} [options] — larger = more pixels keyed out (default 52)
 * @returns {HTMLCanvasElement}
 */
export function extractCellChromaKey(sourceImg, rect, options = {}) {
    const threshold = options.threshold ?? 52;
    const w = Math.max(1, Math.floor(rect.sw));
    const h = Math.max(1, Math.floor(rect.sh));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(sourceImg, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;

    const idx = (x, y) => (y * w + x) * 4;
    let br = 0;
    let bg = 0;
    let bb = 0;
    const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
    for (const [x, y] of corners) {
        const i = idx(x, y);
        br += d[i];
        bg += d[i + 1];
        bb += d[i + 2];
    }
    br /= 4;
    bg /= 4;
    bb /= 4;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = idx(x, y);
            const dr = d[i] - br;
            const dg = d[i + 1] - bg;
            const db = d[i + 2] - bb;
            const dist = Math.sqrt(dr * dr + dg * dg + db * db);
            if (dist < threshold) {
                d[i + 3] = 0;
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}
