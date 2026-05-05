#!/usr/bin/env python3
"""
TGT branded QR-code generator for the post-gig business cards (S129 row 3).

Generates a high-DPI PNG containing a styled QR with the TGT half-orange logo
sitting in a circular cutout in the centre. The QR points at the QrLanding
route (default: https://thegreentangerine.com/qr).

Why this is safe to embed a logo without breaking scans:
  - error correction level H gives 30% redundancy, comfortably absorbing the
    ~22% area we cover with the logo.
  - logo sits on a white circular halo so the camera sees a clean boundary
    around it; QR finder patterns at the corners stay untouched.

Usage:
    python generate-qr-business-card.py [URL] [OUTPUT.png]

Defaults:
    URL    = https://thegreentangerine.com/qr
    OUTPUT = C:/Apps/TGT/shared/branding/tgt-qr-business-card.png

Output is square ~1500px on each side at the default size — print at 300 dpi
gives a 5 cm × 5 cm QR (typical business-card size). Foreground stays pure
black + the QR uses solid black-on-white so any CMYK printer reproduces it
without colour-shift artefacts that would hurt scan reliability.

The TGT brand colours (green #00e676, tangerine #f39c12) live in the LOGO
itself, not the QR pattern — coloured QR pattern modules degrade scan rates,
which is more important on a business card than aesthetic on the dots.
"""

from __future__ import annotations

import sys
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw
from qrcode.constants import ERROR_CORRECT_H

DEFAULT_URL = "https://thegreentangerine.com/qr"
DEFAULT_LOGO = Path(r"C:/Apps/TGT/web/public/logo-512.png")
DEFAULT_OUTPUT = Path(r"C:/Apps/TGT/shared/branding/tgt-qr-business-card.png")

QR_BOX_SIZE = 30   # pixels per QR module — gives ~1500px on a v3 QR
QR_BORDER = 4      # quiet zone, in modules — 4 is the spec-recommended minimum
LOGO_FRACTION = 0.22  # logo diameter as fraction of QR side
HALO_FRACTION = 0.28  # white halo around logo, slightly larger so logo doesn't kiss QR modules


def build_qr(url: str) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,                # auto-fit; longer URLs bump version up
        error_correction=ERROR_CORRECT_H,
        box_size=QR_BOX_SIZE,
        border=QR_BORDER,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGBA")
    return img


def overlay_logo(qr_img: Image.Image, logo_path: Path) -> Image.Image:
    qr_w, qr_h = qr_img.size
    side = min(qr_w, qr_h)

    halo_d = int(side * HALO_FRACTION)
    logo_d = int(side * LOGO_FRACTION)

    # Build a white circular halo on a transparent layer so the logo sits on
    # clean ground rather than directly on QR modules.
    halo_layer = Image.new("RGBA", (qr_w, qr_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(halo_layer)
    cx, cy = qr_w // 2, qr_h // 2
    draw.ellipse(
        (cx - halo_d // 2, cy - halo_d // 2, cx + halo_d // 2, cy + halo_d // 2),
        fill=(255, 255, 255, 255),
    )

    # Composite halo onto QR.
    composed = Image.alpha_composite(qr_img, halo_layer)

    # Resize + circular-mask the logo so the orange-half image sits flush in
    # the halo without leaving square corners visible against the white circle.
    logo = Image.open(logo_path).convert("RGBA").resize(
        (logo_d, logo_d), Image.Resampling.LANCZOS,
    )
    mask = Image.new("L", (logo_d, logo_d), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, logo_d, logo_d), fill=255)
    logo.putalpha(mask)

    composed.paste(
        logo,
        (cx - logo_d // 2, cy - logo_d // 2),
        logo,
    )
    return composed


def main(argv: list[str]) -> int:
    url = argv[1] if len(argv) > 1 else DEFAULT_URL
    output = Path(argv[2]) if len(argv) > 2 else DEFAULT_OUTPUT
    output.parent.mkdir(parents=True, exist_ok=True)

    if not DEFAULT_LOGO.exists():
        print(f"ERROR: logo not found at {DEFAULT_LOGO}", file=sys.stderr)
        return 1

    qr = build_qr(url)
    final = overlay_logo(qr, DEFAULT_LOGO)
    final.save(output, "PNG", dpi=(300, 300))
    print(f"Wrote {output} — {final.size[0]}x{final.size[1]}px @ 300dpi")
    print(f"URL embedded: {url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
