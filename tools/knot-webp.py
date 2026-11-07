# P8: crop the three generated knot photos to the cord, knock the warm-cream
# paper out to TRUE transparency (so the vivid red silk shows as-is on the
# verdict card, no multiply blend), and save as web-sized WebP.
# P8-fix: the first version blurred the red mask with GaussianBlur(18),
# which smeared the alpha so wide that NO pixel stayed fully opaque
# (0.01% opaque) — the knot rendered as a faint ghost. This version keeps a
# hard core alpha (1-2px feather only) and adds a soft contact shadow.
# Run: python3 tools/knot-webp.py
import os

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = '/home/hatch/workspace/yuelao-shots'
OUT = '/home/hatch/workspace/yuelao/sites/yuelao/public/ritual'
JOBS = [
    ('media-generation-knot-tongxin-0-a3063717-b5a6-48e2-8baf-6e680f2321c4.png', 'knot-tongxin.webp'),
    ('media-generation-knot-huojie-0-e7fa6f9e-de22-4aa2-a006-ae916d7823fe.png', 'knot-huo.webp'),
    ('media-generation-knot-huajie-0-ce1327e7-815f-4f2d-ac0a-c3194416b970.png', 'knot-hua.webp'),
]


def knockout(im: Image.Image) -> Image.Image:
    """Return an RGBA image: red cord opaque, cream paper transparent,
    soft contact shadow kept at low alpha near the cord."""
    arr = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]

    # --- core: deep-red cord -------------------------------------------
    # The silk is dark on its shadowed side (R as low as 55, lum ~20) and
    # pale-pink on its lit edge (R-G ~37), while the paper sits at R-G 12-19
    # (max 28 on the border). So the gate is R-G > 30 with a low R floor —
    # the old R > 100 cut out every shadowed strand and left the cord full
    # of holes. A closing + largest-component filter (below) cleans up the
    # few paper speckles that can pass the thin R-G margin.
    red = ((r - g) > 30) & ((r - b) > 20) & (r > 40)
    # Closing (radius ~4px) fills near-black crease specks inside the cord
    # without filling the big loop holes (hundreds of px across).
    red = ndimage.binary_closing(red, structure=np.ones((9, 9)), iterations=1)
    # Keep only components that belong to the knot (one continuous cord):
    # drops isolated paper speckles that passed the R-G gate.
    lab, n = ndimage.label(red)
    sizes = ndimage.sum_labels(red, lab, range(1, n + 1))
    keep = sizes >= 0.005 * sizes.max()
    red = (lab > 0) & keep[np.maximum(lab - 1, 0)]
    # Fill small enclosed specks inside the cord (near-white specular dots
    # and near-black crease dots that fail the red gate) and recolour them
    # with the local cord colour — otherwise they stay as white pinholes.
    # Real loop holes are paper-coloured (lum ~225, R-G ~13) and bigger, so
    # they are never filled: only small components that are clearly not
    # paper (dark, or redder than paper) get filled.
    hlab, hn = ndimage.label(~red)
    border = set(np.unique(np.concatenate(
        [hlab[0, :], hlab[-1, :], hlab[:, 0], hlab[:, -1]])))
    filled = np.zeros_like(red)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    for i in range(1, hn + 1):
        if i in border:
            continue
        comp = hlab == i
        if comp.sum() >= 2500:
            continue
        if lum[comp].mean() < 210 or (r[comp] - g[comp]).mean() > 18:
            filled |= comp
    if filled.any():
        red |= filled
        blurred = ndimage.gaussian_filter(arr, (8, 8, 0))
        arr = np.where(filled[..., None], blurred, arr)
        r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    # 1-2px feather only: the cord stays fully opaque, edges anti-alias.
    core = ndimage.gaussian_filter(red.astype(np.float32), 1.2)
    core = np.clip(core, 0.0, 1.0)

    # --- shadow: pixels darker than the paper, near the cord ------------
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    border = np.concatenate([lum[0, :], lum[-1, :], lum[:, 0], lum[:, -1]])
    bg_lum = float(np.median(border))
    shadow = np.clip((bg_lum - lum - 12.0) / 70.0, 0.0, 0.35)
    shadow[red] = 0.0
    # Only within ~45px of the cord, fading out at the edge, so paper
    # texture speckles elsewhere in the frame never become a veil.
    dist = ndimage.distance_transform_edt(~red)
    shadow *= np.clip((45.0 - dist) / 20.0, 0.0, 1.0)
    shadow = ndimage.gaussian_filter(shadow, 3.0)

    alpha = np.maximum(core, shadow)
    alpha_u8 = (np.clip(alpha, 0.0, 1.0) * 255).round().astype(np.uint8)
    # NB: arr (not the source) — filled specks were recoloured in arr.
    out = np.dstack([arr.astype(np.uint8), alpha_u8])
    return Image.fromarray(out, 'RGBA'), alpha


for src_name, out_name in JOBS:
    im = Image.open(os.path.join(SRC, src_name))
    rgba, alpha = knockout(im)
    # Crop to the visible knot + margin.
    ys, xs = np.where(alpha > 0.02)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    margin = max(24, int(0.04 * max(im.size)))
    x0 = max(0, x0 - margin)
    y0 = max(0, y0 - margin)
    x1 = min(im.size[0], x1 + margin + 1)
    y1 = min(im.size[1], y1 + margin + 1)
    crop = rgba.crop((x0, y0, x1, y1))
    # Longest side 560px: the card shows it ~180px tall, so ~3x is plenty.
    scale = 560 / max(crop.size)
    if scale < 1:
        nw, nh = int(crop.size[0] * scale), int(crop.size[1] * scale)
        crop = crop.resize((nw, nh), Image.LANCZOS)
    path = os.path.join(OUT, out_name)
    crop.save(path, 'WebP', quality=82, method=6)
    a = np.asarray(crop.split()[3], dtype=np.float32) / 255.0
    print(f'{out_name}: {crop.size} {os.path.getsize(path)//1024}KB '
          f'(opaque {(a > 0.98).mean():.1%}, partial {((a > 0.02) & (a <= 0.98)).mean():.1%})')
print('done')
