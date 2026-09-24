"""
============================================================================
SPLIT THE OFFICIAL LOCKUP VECTOR INTO ITS PARTS
----------------------------------------------------------------------------
Jayden supplied a proper vectorisation of the full lockup. Measured against
images/logo.png at 721x253: 8.64% of pixels differ and ONE HUNDRED PERCENT of
that sits inside a 2px band along the artwork's own edges. Zero structural
difference. That is a better result than either of the traces written here
earlier (the mark trace left 1.8% away from edges, the wordmark 8.3% of its
ink), so this file replaces both of them as the source of truth.

The site needs it in three shapes:

  logo-lockup.svg   the whole thing, for the nav and the footer, replacing a
                    178KB PNG with 26KB of vector
  logo-mark.svg     the shield alone, inlined into the splash so its two
                    colours can be stroke-drawn separately
  logo-word.svg     the wordmark alone, which the splash wipes as one block

Splitting is by x position: in logo.png the mark occupies x 3-200 and the
wordmark x 222-723, with an empty gutter between them at 201-221. The supplied
SVG shares that coordinate space, so every subpath falls cleanly on one side.
Each output is re-origined to its own bounding box so it can be sized on its
own terms.

Run:  python scripts/split-lockup.py
Lives in scripts/, which .vercelignore excludes — it never deploys.
============================================================================
"""
import io
import re

SRC = r'E:\Workspaces\das\web\images\logo-lockup.svg'
OUT_MARK = r'E:\Workspaces\das\web\images\logo-mark.svg'
OUT_WORD = r'E:\Workspaces\das\web\images\logo-word.svg'

GUTTER = 210.0            # empty columns run 201-221 in the artwork


def subpaths(d):
    """Split a path's d attribute into its M...Z subpaths."""
    return [('M' + p).strip() for p in d.split('M') if p.strip()]


def bbox(sub):
    pts = re.findall(r'(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)', sub)
    xs = [float(a) for a, _ in pts]
    ys = [float(b) for _, b in pts]
    return min(xs), min(ys), max(xs), max(ys)


def shift(sub, dx, dy):
    def rep(m):
        return f'{float(m.group(1)) - dx:.3f},{float(m.group(2)) - dy:.3f}'
    return re.sub(r'(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)', rep, sub)


def main():
    s = io.open(SRC, encoding='utf-8').read()
    paths = re.findall(r'<path fill="(#[0-9A-Fa-f]{6})"[^>]*?d="([^"]+)"', s)
    assert len(paths) == 2, f'expected 2 colour paths, got {len(paths)}'

    groups = {'mark': {}, 'word': {}}
    for colour, d in paths:
        for sub in subpaths(d):
            x0, y0, x1, y1 = bbox(sub)
            side = 'mark' if x1 < GUTTER else 'word'
            groups[side].setdefault(colour, []).append(sub)

    for side in ('mark', 'word'):
        allsubs = [sp for subs in groups[side].values() for sp in subs]
        xs0 = min(bbox(sp)[0] for sp in allsubs)
        ys0 = min(bbox(sp)[1] for sp in allsubs)
        xs1 = max(bbox(sp)[2] for sp in allsubs)
        ys1 = max(bbox(sp)[3] for sp in allsubs)
        w, h = xs1 - xs0, ys1 - ys0

        # grey first, navy over it — the splash draws them in that order
        order = [c for c in ('#96A0AF', '#1A2E5A') if c in groups[side]]
        body = ''
        for i, colour in enumerate(order):
            d = ' '.join(shift(sp, xs0, ys0) for sp in groups[side][colour])
            cls = f' class="p{i + 1}"'
            body += f'  <path{cls} fill="{colour}" fill-rule="evenodd" d="{d}"/>\n'

        out = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.3f} {h:.3f}" '
            f'role="img" aria-label="Driver Appreciation Solutions">\n'
            f'  <!-- Split from images/logo-lockup.svg, the official vectorisation.\n'
            f'       Verified against logo.png: 100% of its pixel difference lies on the\n'
            f'       antialiasing band, none away from edges. scripts/split-lockup.py -->\n'
            + body + '</svg>\n'
        )
        path = OUT_MARK if side == 'mark' else OUT_WORD
        io.open(path, 'w', encoding='utf-8', newline='\n').write(out)
        counts = {c: len(v) for c, v in groups[side].items()}
        print(f'{side:5} {w:7.2f} x {h:7.2f}  aspect {w/h:.4f}  '
              f'subpaths {counts}  {len(out)/1024:.1f} KB -> {path.split(chr(92))[-1]}')


if __name__ == '__main__':
    main()
