"""
============================================================================
VECTORISE THE DAS WORDMARK — by tracing the real artwork
----------------------------------------------------------------------------
A CORRECTION IS BAKED INTO THIS FILE. An earlier version of this script
rebuilt the wordmark from Archivo Black outlines, because the print PDF sets
"DRIVER / APPRECIATION / SOLUTIONS" in ArchivoBlack-Regular and its line-width
ratios matched the logo to within 1.1%. Measured against the real artwork it
was wrong: the logo's stems are ~11px at a 46px cap, Archivo Black's are 17-24,
and the letters merged into each other. That PDF text is the DOCUMENT's
masthead, not the logo. The wordmark's typeface is still unidentified.

So this traces the actual pixels instead of guessing at the type — the same
pipeline as scripts/vectorize-mark.py, pointed at the wordmark region of
images/logo.png (x 222-724, y 65-222, i.e. 502x157 of real artwork).

WHY A SEPARATE FILE RATHER THAN INLINE. The mark is inlined on every page
because its two paths are animated individually. The wordmark only wipes as one
block, so it ships as images/logo-word.svg and is referenced with <img>: one
request, cached across the whole site, sharp at any size, and it keeps ~25KB of
path data out of 31 HTML documents.

Letterforms are curves, so the polygon tolerance is much tighter here than for
the mark's straight edges, and the source is upsampled 6x first so the contour
has sub-pixel room to land.

Run:  python scripts/vectorize-wordmark.py
Writes: images/logo-word.svg
Lives in scripts/, which .vercelignore excludes — it never deploys.
============================================================================
"""
import io
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
from shapely.geometry import Polygon
from shapely.ops import unary_union

SRC = r'E:\Workspaces\das\web\images\logo.png'
OUT = r'E:\Workspaces\das\web\images\logo-word.svg'

# measured content bounds of the wordmark inside logo.png
BOX = (222, 65, 222 + 502, 65 + 157)
UP = 6                      # upsample before tracing
TOL = 0.30 * UP             # 0.30 source px — letterforms need far more than the mark
NAVY = '#1A2E5A'


def load():
    im = Image.open(SRC).convert('RGBA').crop(BOX)
    w, h = im.size
    im = im.resize((w * UP, h * UP), Image.LANCZOS)
    a = np.array(im).astype(np.float32)
    # ink coverage: alpha, and darkness where the file is opaque
    alpha = a[..., 3] / 255.0
    lum = a[..., :3].mean(-1) / 255.0
    ink = np.where(alpha > 0.02, alpha * (1.0 - lum), 0.0)
    ink = ink / max(ink.max(), 1e-6)
    return ink, w, h


def contours(field, level=0.5, blur=0.8):
    f = gaussian_filter(field.astype(np.float32), blur)
    f = np.pad(f, 1, constant_values=0.0)

    a = f[:-1, :-1] >= level
    b = f[:-1, 1:] >= level
    c = f[1:, 1:] >= level
    d = f[1:, :-1] >= level
    case = (a.astype(np.uint8) << 3) | (b.astype(np.uint8) << 2) | (c.astype(np.uint8) << 1) | d.astype(np.uint8)

    def ip(v0, v1):
        den = v1 - v0
        return 0.5 if den == 0 else float(np.clip((level - v0) / den, 0.0, 1.0))

    segs = {}

    def add(p, q):
        segs.setdefault(p, []).append(q)
        segs.setdefault(q, []).append(p)

    ys, xs = np.nonzero((case != 0) & (case != 15))
    for y, x in zip(ys.tolist(), xs.tolist()):
        v = (float(f[y, x]), float(f[y, x + 1]), float(f[y + 1, x + 1]), float(f[y + 1, x]))
        T = (x + ip(v[0], v[1]), float(y))
        R = (float(x + 1), y + ip(v[1], v[2]))
        B = (x + ip(v[3], v[2]), float(y + 1))
        L = (float(x), y + ip(v[0], v[3]))
        table = {
            1: [(L, B)], 2: [(B, R)], 3: [(L, R)], 4: [(T, R)],
            5: [(L, T), (B, R)], 6: [(T, B)], 7: [(L, T)], 8: [(L, T)],
            9: [(T, B)], 10: [(L, B), (T, R)], 11: [(T, R)], 12: [(L, R)],
            13: [(B, R)], 14: [(L, B)],
        }
        for p, q in table.get(int(case[y, x]), []):
            add((round(p[0], 4), round(p[1], 4)), (round(q[0], 4), round(q[1], 4)))

    rings, used = [], set()
    for start in list(segs.keys()):
        if start in used:
            continue
        ring, cur, prev = [start], start, None
        used.add(start)
        while True:
            nxt = None
            for cand in segs.get(cur, []):
                if cand != prev and (cand not in used or cand == ring[0]):
                    nxt = cand
                    break
            if nxt is None or nxt == ring[0]:
                break
            ring.append(nxt)
            used.add(nxt)
            prev, cur = cur, nxt
        if len(ring) >= 4:
            rings.append([(px - 1.0, py - 1.0) for px, py in ring])
    return rings


def main():
    ink, w, h = load()
    print(f'wordmark region {w}x{h}, traced at {UP}x = {ink.shape[1]}x{ink.shape[0]}')

    # LET evenodd DO THE NESTING. Marching squares returns every closed
    # contour -- outlines and counters alike -- and they never overlap, they
    # only nest. That is precisely what fill-rule="evenodd" resolves: a ring
    # inside a ring is a hole, for free.
    #
    # Two wrong turns before this. Unioning the rings first filled in the
    # middle of every D, O, P, R and A, because union has no concept of which
    # ring was a counter. Classifying nesting depth by hand then found only 4
    # of the wordmark's 12 counters, because contours that touch at a saddle
    # share a node and my walker merged them. Emitting the rings untouched and
    # letting the fill rule decide sidesteps both.
    rings = []
    for r in contours(ink):
        g = Polygon(r)
        if not g.is_valid:
            g = g.buffer(0)
        if g.is_empty or g.geom_type != 'Polygon' or g.area < (UP * UP):
            continue
        g = g.simplify(TOL, preserve_topology=True)
        if not g.is_empty and g.geom_type == 'Polygon' and g.area > (UP * UP):
            rings.append(list(g.exterior.coords))
    verts = sum(len(r) for r in rings)
    print(f'{len(rings)} contours, {verts} vertices')

    sx = w / ink.shape[1]
    sy = h / ink.shape[0]

    def ring(coords):
        pts = [(x * sx, y * sy) for x, y in coords]
        if pts[0] == pts[-1]:
            pts = pts[:-1]
        return 'M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in pts) + ' Z'

    d = [ring(r) for r in rings]

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'role="img" aria-label="Driver Appreciation Solutions">\n'
        f'  <!-- Traced from the wordmark region of images/logo.png (502x157 of real\n'
        f'       artwork), NOT rebuilt from a typeface. An earlier attempt used Archivo\n'
        f'       Black outlines from the print PDF and measured 1.8x too heavy — that\n'
        f'       PDF text is the document masthead, not the logo. The wordmark\'s own\n'
        f'       typeface remains unidentified. scripts/vectorize-wordmark.py -->\n'
        f'  <path fill="{NAVY}" fill-rule="evenodd" d="{" ".join(d)}"/>\n'
        f'</svg>\n'
    )
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(svg)
    print(f'wrote {OUT}  {len(svg)/1024:.1f} KB')


if __name__ == '__main__':
    main()
