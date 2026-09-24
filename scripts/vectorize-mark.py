"""
============================================================================
VECTORISE THE DAS MARK
----------------------------------------------------------------------------
Jayden: "what's the reason off duty's one is so clean vs ours?"

THE ANSWER. Off Duty's splash mark is an inline SVG — vector paths. It is
resolution-independent, so it is pin-sharp at any size on any screen, it
weighs a couple of KB, and its internal lines can be STROKE-DRAWN, which is
why their animation draws rather than fades. Ours was a 728x259 PNG. A raster
can only be scaled, and scaling a raster past its own pixels is interpolation,
not detail. That is the entire difference.

THE FIX, WITHOUT ANY NEW ARTWORK. The DAS mark is flat two-colour geometry
with straight edges — the single best case for tracing. And a better source
than the website's exists: journal-of-driver-recognition/_proof.pdf embeds the
mark at 458x567, 2.3x larger than images/logo-mark.png.

So this traces that artwork into a true vector:

  1. Render the mark out of the PDF at 4x with PyMuPDF, which gives clean,
     well-antialiased edges to find.
  2. Classify every pixel to navy (#1A2E5A), grey (#96A0AF) or background.
  3. Blur each mask slightly and run marching squares at the 0.5 level. The
     blur is deliberate: it turns a stair-stepped binary edge into a smooth
     field, so the contour lands between pixels and a straight diagonal comes
     back straight instead of serrated.
  4. Simplify with Douglas-Peucker. Every edge in this mark is a straight
     line, so a correct trace collapses each run to two points — the vertex
     count is the honest measure of whether the trace worked.
  5. Emit ONE grey path for the whole silhouette and ONE navy path on top of
     it. Tracing the two colours as neighbours would leave hairline seams
     along every shared edge; painting navy over the full silhouette cannot.

Run:  python scripts/vectorize-mark.py
Writes: images/logo-mark.svg
Lives in scripts/, which .vercelignore excludes — it never deploys.
============================================================================
"""
import os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_fill_holes, binary_closing
from shapely.geometry import Polygon
from shapely.ops import unary_union

PDF = r'E:\Workspaces\das\journal-of-driver-recognition\_proof.pdf'
XREF = 13
PAGE = 0
SCALE = 4.0                     # render multiplier over the embedded 458x567
OUT = r'E:\Workspaces\das\web\images\logo-mark.svg'

NAVY = (0x1A, 0x2E, 0x5A)
GREY = (0x96, 0xA0, 0xAF)


def render():
    import fitz
    d = fitz.open(PDF)
    page = d[PAGE]
    rect = page.get_image_rects(XREF)[0]
    info = d.extract_image(XREF)
    z = (info['width'] * SCALE) / rect.width
    pm = page.get_pixmap(matrix=fitz.Matrix(z, z), clip=rect, alpha=False)
    a = np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.height, pm.width, pm.n)[:, :, :3]
    return a.astype(np.float32), info['width'], info['height']


def classify(a):
    """Unmix each pixel into (colour, coverage) instead of snapping to nearest.

    WHY NOT NEAREST-COLOUR. A pixel that is half navy and half background
    averages to about #8A94AA — which is almost exactly the grey, #96A0AF. So
    every antialiased navy edge was being classified as GREY, wrapping the navy
    in a one-pixel grey halo and pushing the whole silhouette outward. The diff
    against the canonical artwork sat at 13% and would not fall when blurred,
    which is the signature of a systematic offset rather than edge noise.

    Instead, model the pixel as a composite: P = B + alpha * (C - B) for each
    candidate C, solve alpha by projection, and keep whichever candidate
    explains the pixel with the smallest residual. A 50/50 navy-on-background
    pixel is then explained perfectly by navy at alpha 0.5, and grey only
    badly — which is the truth about that pixel.

    Returns (navy_mask, grey_mask) at 50% coverage, which is where the true
    edge of the artwork lies.
    """
    a = a.astype(np.float32)
    bg = a[0, 0]
    out = []
    best_res = None
    best_idx = None
    best_alpha = None
    for i, C in enumerate([np.array(NAVY, np.float32), np.array(GREY, np.float32)]):
        d = C - bg
        denom = float((d * d).sum())
        alpha = np.clip(((a - bg) * d).sum(-1) / denom, 0.0, 1.0)
        resid = np.linalg.norm(a - (bg + alpha[..., None] * d), axis=-1)
        if best_res is None:
            best_res, best_idx, best_alpha = resid, np.zeros(resid.shape, np.uint8), alpha
        else:
            take = resid < best_res
            best_res = np.where(take, resid, best_res)
            best_idx = np.where(take, i, best_idx).astype(np.uint8)
            best_alpha = np.where(take, alpha, best_alpha)
    covered = best_alpha >= 0.5
    return (best_idx == 0) & covered, (best_idx == 1) & covered


def contours(mask, blur=1.1, level=0.5):
    """Marching squares with linear interpolation. Returns closed rings."""
    f = gaussian_filter(mask.astype(np.float32), blur)
    f = np.pad(f, 1, constant_values=0.0)
    h, w = f.shape

    # every cell's 4 corners, above/below the level
    a = f[:-1, :-1] >= level
    b = f[:-1, 1:] >= level
    c = f[1:, 1:] >= level
    d = f[1:, :-1] >= level
    case = (a.astype(np.uint8) << 3) | (b.astype(np.uint8) << 2) | (c.astype(np.uint8) << 1) | d.astype(np.uint8)

    def ip(v0, v1):
        den = (v1 - v0)
        return 0.5 if den == 0 else float(np.clip((level - v0) / den, 0.0, 1.0))

    # edge midpoints, sub-pixel: T=top L=left B=bottom R=right of a cell
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
        k = int(case[y, x])
        table = {
            1: [(L, B)], 2: [(B, R)], 3: [(L, R)], 4: [(T, R)],
            5: [(L, T), (B, R)], 6: [(T, B)], 7: [(L, T)], 8: [(L, T)],
            9: [(T, B)], 10: [(L, B), (T, R)], 11: [(T, R)], 12: [(L, R)],
            13: [(B, R)], 14: [(L, B)],
        }
        for p, q in table.get(k, []):
            add((round(p[0], 4), round(p[1], 4)), (round(q[0], 4), round(q[1], 4)))

    # walk the segment graph into closed rings
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
            rings.append([(px - 1.0, py - 1.0) for px, py in ring])   # undo the pad
    return rings


def to_polys(rings, tol):
    polys = []
    for r in rings:
        if len(r) < 4:
            continue
        p = Polygon(r)
        if not p.is_valid:
            p = p.buffer(0)
        if p.is_empty or p.area < 6:
            continue
        p = p.simplify(tol, preserve_topology=True)
        if not p.is_empty and p.area > 6:
            polys.append(p)
    return polys


def d_attr(geom, sx, sy, ox, oy):
    def ring(coords):
        pts = [((x - ox) * sx, (y - oy) * sy) for x, y in coords]
        if pts[0] == pts[-1]:
            pts = pts[:-1]
        return 'M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in pts) + ' Z'
    out = []
    geoms = geom.geoms if geom.geom_type == 'MultiPolygon' else [geom]
    for g in geoms:
        out.append(ring(list(g.exterior.coords)))
        for h in g.interiors:
            out.append(ring(list(h.coords)))
    return ' '.join(out)


def main():
    a, sw, sh = render()
    H, W, _ = a.shape
    navy, grey = classify(a)
    print(f'rendered {W}x{H} from an embedded {sw}x{sh}; navy {navy.sum()}px, grey {grey.sum()}px')

    # 2.2 at a 4x render is 0.55 source px. Tighter than that and the trace
    # keeps the antialiasing wobble along every straight edge as vertices --
    # 4,700 of them for a shape that has well under two hundred real corners.
    tol = 3.0 * SCALE / 4.0

    # The outer shield is ONE simple outline. Straight off the unmixed masks it
    # traced at 1,917 vertices, because the 50%-coverage boundary is ragged at
    # pixel scale and every wobble became a corner. Close the mask first, then
    # contour it through a wider blur: the outline is a long smooth silhouette,
    # unlike the navy inlays, so it can take far more smoothing without losing
    # a real corner.
    silhouette = binary_fill_holes(binary_closing(navy | grey, np.ones((5, 5))))
    sil_polys = to_polys(contours(silhouette, blur=2.6), tol * 1.6)
    navy_polys = to_polys(contours(navy), tol)

    sil = unary_union(sil_polys)
    nav = unary_union(navy_polys)

    verts = lambda g: sum(len(p.exterior.coords) + sum(len(i.coords) for i in p.interiors)
                          for p in (g.geoms if g.geom_type == 'MultiPolygon' else [g]))
    print(f'silhouette: {verts(sil)} vertices   navy: {verts(nav)} vertices')

    minx, miny, maxx, maxy = sil.bounds

    # THE PDF COPY IS STRETCHED. Measured content bounds:
    #   images/logo.png mark region   198 x 253   aspect 0.7826  <- canonical
    #   the PDF's embedded copy                   aspect 0.8189
    # a 4.6% horizontal stretch introduced when it was placed in the layout.
    # The trace is faithful to what it traced, so it inherits the stretch;
    # normalising x and y independently against the canonical box removes it.
    # (This is also why the first diff against logo-mark.png scored so badly:
    # that file was cut with no margin at all, clipping 2px off the artwork.)
    VB_W, VB_H = 198.0, 253.0
    sx = VB_W / (maxx - minx)
    sy = VB_H / (maxy - miny)

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VB_W:.2f} {VB_H:.2f}" '
        f'role="img" aria-label="Driver Appreciation Solutions">\n'
        f'  <!-- Traced from the 458x567 mark embedded in the Journal of Driver\n'
        f'       Recognition print PDF, which is the largest DAS artwork that exists.\n'
        f'       Grey is the whole silhouette; navy is painted over it, so the shared\n'
        f'       edges cannot show a seam. scripts/vectorize-mark.py rebuilds it. -->\n'
        f'  <path fill="#96A0AF" d="{d_attr(sil, sx, sy, minx, miny)}"/>\n'
        f'  <path fill="#1A2E5A" d="{d_attr(nav, sx, sy, minx, miny)}"/>\n'
        f'</svg>\n'
    )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8', newline='\n').write(svg)
    print(f'wrote {OUT}  {len(svg)/1024:.1f} KB  viewBox 0 0 {VB_W:.2f} {VB_H:.2f}')


if __name__ == '__main__':
    main()
