"""
The downloadable library card PDF (A4, front + back at real card size).

Layout follows the approved card design. All positions below are in mm
measured from the TOP-LEFT of the card, and mirrored 1:1 by the on-screen
card in frontend/src/pages/LibraryCard.jsx - change one, change the other.
"""
import io
import math

from PIL import Image, ImageOps
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import code128, qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

NAVY = HexColor("#1b2d5a")
SHIELD = HexColor("#2c4479")
GOLD = HexColor("#b8985c")
CREAM = HexColor("#e9e8e0")
PAPER = HexColor("#f4f4f1")
HEADER_TEXT = HexColor("#f3efe2")
INK = HexColor("#16181d")
GREY = HexColor("#6b7280")
EDGE = HexColor("#cfcfca")
BLACK_BAND = HexColor("#151515")

CARD_W, CARD_H = 85.6 * mm, 54 * mm  # standard ID-1 / CR80 card

LIBRARY_NAME = "CENTRAL UNIVERSITY LIBRARY"
CARD_TITLE = "STUDENT LIBRARY CARD"
# Each term is a list of printed lines (the design breaks them by hand).
TERMS = [
    ["This card is non-transferable and valid only for the registered", "student."],
    ["Must be presented when borrowing or returning library materials."],
    ["Loss of card must be reported immediately to the", "Circulation Desk."],
    ["All books must be returned before final clearance."],
]


# ------------------------------------------------------------ shared data
# (also sent to the browser so the on-screen card draws identical codes)

def barcode_modules(text):
    """Code 128 as a string of 1 (bar) / 0 (space) modules."""
    bc = code128.Code128(str(text), barWidth=1, quiet=False, humanReadable=False, barHeight=10)
    _ = bc.width  # forces encoding; `decomposed` only exists after this
    out = []
    for ch in bc.decomposed:
        width = ord(ch.lower()) - ord("a") + 1
        out.append(("1" if ch.isupper() else "0") * width)
    return "".join(out)


def qr_matrix(text):
    """QR code as a list of row strings made of '#' (dark) and '.' (light)."""
    widget = qr.QrCodeWidget(str(text))
    widget.draw()  # builds the matrix
    q = widget.qr
    n = q.getModuleCount()
    return ["".join("#" if q.isDark(r, c) else "." for c in range(n)) for r in range(n)]


# ---------------------------------------------------------------- helpers

def _y(y0, top):
    """PDF y for a point `top` mm below the card's top edge."""
    return y0 + CARD_H - top * mm


def _fit_size(text, font, size, max_width, min_size=5.5):
    """Largest font size <= size at which `text` fits `max_width`."""
    while size > min_size and stringWidth(text, font, size) > max_width:
        size -= 0.2
    return size


def _ellipsize(text, font, size, max_width):
    text = str(text or "")
    if stringWidth(text, font, size) <= max_width:
        return text
    while text and stringWidth(text + "…", font, size) > max_width:
        text = text[:-1]
    return text + "…"


def _photo_reader(app, aspect):
    """The student's photo, upright and centre-cropped (slightly top-biased) to `aspect`."""
    try:
        with app.photo.open("rb") as fh:
            img = ImageOps.exif_transpose(Image.open(fh)).convert("RGB")
    except Exception:
        return None
    w, h = img.size
    if w / h > aspect:  # too wide: trim the sides
        new_w = int(h * aspect)
        left = (w - new_w) // 2
        img = img.crop((left, 0, left + new_w, h))
    else:  # too tall: trim the bottom more than the top, to keep the face
        new_h = int(w / aspect)
        top = int((h - new_h) * 0.25)
        img = img.crop((0, top, w, top + new_h))
    return ImageReader(img)


def _card_base(c, x, y, fill):
    """Rounded card body; returns with the clip active (caller must restoreState)."""
    c.saveState()
    c.setFillColor(fill)
    c.setStrokeColor(EDGE)
    c.setLineWidth(0.5)
    c.roundRect(x, y, CARD_W, CARD_H, 3 * mm, stroke=1, fill=1)
    clip = c.beginPath()
    clip.roundRect(x, y, CARD_W, CARD_H, 3 * mm)
    c.clipPath(clip, stroke=0, fill=0)


def _band(c, x, y, top, bottom, color):
    c.setFillColor(color)
    c.rect(x, _y(y, bottom), CARD_W, (bottom - top) * mm, stroke=0, fill=1)


def _draw_logo(c, x, y, left, top, size):
    """Shield + open book + laurel. Geometry is a 100x100 box, same as the on-screen SVG."""
    s = size * mm / 100.0
    ox, oy = x + left * mm, _y(y, top)

    def P(ux, uy):
        return ox + ux * s, oy - uy * s

    # laurel leaves (two mirrored branches)
    c.setFillColor(GOLD)
    for side in (-1, 1):
        for theta in range(100, 240, 20):
            rad = math.radians(theta)
            ux, uy = 50 + 41 * math.cos(rad), 52 + 41 * math.sin(rad)
            if side == 1:
                ux = 100 - ux
            angle = (theta + 90 - 15) * side
            px, py = P(ux, uy)
            c.saveState()
            c.translate(px, py)
            c.rotate(-angle)
            c.ellipse(-6.5 * s, -2.7 * s, 6.5 * s, 2.7 * s, stroke=0, fill=1)
            c.restoreState()

    # shield
    sh = c.beginPath()
    sh.moveTo(*P(27, 20))
    sh.lineTo(*P(73, 20))
    sh.lineTo(*P(73, 48))
    x1, y1 = P(73, 66); x2, y2 = P(62, 76); x3, y3 = P(50, 82)
    sh.curveTo(x1, y1, x2, y2, x3, y3)
    x1, y1 = P(38, 76); x2, y2 = P(27, 66); x3, y3 = P(27, 48)
    sh.curveTo(x1, y1, x2, y2, x3, y3)
    sh.close()
    c.setFillColor(SHIELD)
    c.setStrokeColor(GOLD)
    c.setLineWidth(max(0.35, 2.2 * s))
    c.drawPath(sh, stroke=1, fill=1)

    # open book
    c.setFillColor(HexColor("#f5f0e1"))
    c.setStrokeColor(GOLD)
    c.setLineWidth(max(0.2, 0.9 * s))
    for side in (-1, 1):
        bk = c.beginPath()
        bk.moveTo(*P(50, 36))
        bx1, by1 = P(50 + side * 6, 33); bx2, by2 = P(50 + side * 14, 33); bx3, by3 = P(50 + side * 18, 35)
        bk.curveTo(bx1, by1, bx2, by2, bx3, by3)
        bk.lineTo(*P(50 + side * 18, 59))
        bx1, by1 = P(50 + side * 14, 57); bx2, by2 = P(50 + side * 6, 57); bx3, by3 = P(50, 60)
        bk.curveTo(bx1, by1, bx2, by2, bx3, by3)
        bk.close()
        c.drawPath(bk, stroke=1, fill=1)


def _draw_qr(c, data, x, y, left, top, size, pad=0.6):
    """White tile (card colour irrelevant) with the QR inside."""
    c.setFillColor(HexColor("#ffffff"))
    c.rect(x + left * mm, _y(y, top + size), size * mm, size * mm, stroke=0, fill=1)
    widget = qr.QrCodeWidget(str(data))
    bx0, by0, bx1, by1 = widget.getBounds()
    inner = (size - 2 * pad) * mm
    d = Drawing(inner, inner, transform=[inner / (bx1 - bx0), 0, 0, inner / (by1 - by0), 0, 0])
    d.add(widget)
    renderPDF.draw(d, c, x + (left + pad) * mm, _y(y, top + size - pad))


# ------------------------------------------------------------------ front

def _draw_front(c, app, x, y):
    _card_base(c, x, y, PAPER)

    _band(c, x, y, 12.4, 38.4, CREAM)      # body band behind photo + details
    _band(c, x, y, 0, 12.4, NAVY)          # header
    _band(c, x, y, 0, 0.9, GOLD)           # gold line, top edge
    _band(c, x, y, 12.4, 13.1, GOLD)       # gold line under the header

    _draw_logo(c, x, y, left=4.5, top=1.9, size=9.6)

    # Title + subtitle, centred in the space right of the logo
    cx = x + 48.8 * mm
    c.setFillColor(HEADER_TEXT)
    t_size = _fit_size(LIBRARY_NAME, "Times-Bold", 10.5, 64 * mm)
    c.setFont("Times-Bold", t_size)
    c.drawCentredString(cx, _y(y, 6.4), LIBRARY_NAME)
    c.setFont("Times-Bold", 7.8)
    c.drawCentredString(cx, _y(y, 10.2), CARD_TITLE)

    # Photo
    pl, pt, pw, ph = 5.0, 15.1, 17.8, 21.8
    reader = _photo_reader(app, pw / ph)
    c.saveState()
    clip = c.beginPath()
    clip.rect(x + pl * mm, _y(y, pt + ph), pw * mm, ph * mm)
    c.clipPath(clip, stroke=0, fill=0)
    if reader:
        c.drawImage(reader, x + pl * mm, _y(y, pt + ph), pw * mm, ph * mm, mask="auto")
    else:
        c.setFillColor(EDGE)
        c.rect(x + pl * mm, _y(y, pt + ph), pw * mm, ph * mm, stroke=0, fill=1)
    c.restoreState()

    # Details: bold label + regular value
    valid = app.valid_thru.strftime("%b %Y") if app.valid_thru else ""
    rows = [
        ("Name:", app.full_name),
        ("ID No:", app.student_id),
        ("Department:", app.department),
        ("Session:", app.session),
        ("Valid Thru:", valid),
    ]
    tx = x + 25.6 * mm
    avail = (85.6 - 25.6 - 3.2) * mm
    for i, (label, value) in enumerate(rows):
        base = _y(y, 19.3 + i * 4.4)
        size = 9.4
        while size > 5.5 and (
            stringWidth(label + " ", "Helvetica-Bold", size) + stringWidth(str(value), "Helvetica", size) > avail
        ):
            size -= 0.2
        value = _ellipsize(value, "Helvetica", size, avail - stringWidth(label + " ", "Helvetica-Bold", size))
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", size)
        c.drawString(tx, base, label)
        c.setFont("Helvetica", size)
        c.drawString(tx + stringWidth(label + " ", "Helvetica-Bold", size), base, value)

    # Barcode + its number
    number = app.card_number or ""
    bc = code128.Code128(number, barWidth=1, quiet=False, humanReadable=False, barHeight=7.6 * mm)
    units = bc.width
    bc = code128.Code128(number, barWidth=(43.1 * mm) / units, quiet=False, humanReadable=False, barHeight=7.6 * mm)
    bc.drawOn(c, x + 6.8 * mm, _y(y, 40.1 + 7.6))
    c.setFillColor(INK)
    c.setFont("Helvetica", 8)
    c.drawCentredString(x + (6.8 + 43.1 / 2) * mm, _y(y, 51.0), number)

    # Signature block (left blank on purpose - to be signed on the printed card)
    c.setFillColor(INK)
    c.setFont("Helvetica", 6.4)
    c.drawCentredString(x + 69.25 * mm, _y(y, 42.4), "Chief Librarian:")
    c.setStrokeColor(INK)
    c.setLineWidth(0.4)
    c.line(x + 58.0 * mm, _y(y, 48.8), x + 80.5 * mm, _y(y, 48.8))

    c.restoreState()


# ------------------------------------------------------------------- back

def _draw_back(c, app, x, y):
    _card_base(c, x, y, CREAM)

    _band(c, x, y, 0, 3.9, NAVY)
    _band(c, x, y, 3.9, 12.2, BLACK_BAND)
    _band(c, x, y, 0, 0.9, GOLD)
    _band(c, x, y, 12.2, 13.1, GOLD)

    c.setFillColor(NAVY)
    c.setFont("Times-Bold", 9.2)
    c.drawCentredString(x + CARD_W / 2, _y(y, 18.7), "TERMS & CONDITIONS")

    # Bullet list with hanging indent. Font size is chosen so the longest line
    # just fits the card (the design's own line breaks are kept as-is).
    leading = 3.55
    left = 4.8 * mm
    text_left = 6.3 * mm
    widest = max((l for item in TERMS for l in item), key=lambda t: stringWidth(t, "Helvetica", 10))
    size = min(7.7, _fit_size(widest, "Helvetica", 7.7, 75.0 * mm))
    base_top = 24.6
    c.setFillColor(INK)
    c.setFont("Helvetica", size)
    for item in TERMS:
        c.drawString(x + left, _y(y, base_top), "•")
        for line in item:
            c.drawString(x + text_left, _y(y, base_top), line)
            base_top += leading

    c.setFont("Helvetica", 7.7)
    c.drawString(x + left, _y(y, 47.6), "If found, please return to:")
    c.drawString(x + left, _y(y, 51.0), "Central University Library, Circulation Desk")

    _draw_qr(c, app.card_number or "", x, y, left=70.2, top=41.0, size=10.7)

    c.restoreState()


# ------------------------------------------------------------------- page

def build_card_pdf(app):
    buf = io.BytesIO()
    page_w, page_h = 210 * mm, 297 * mm
    c = canvas.Canvas(buf, pagesize=(page_w, page_h))
    c.setTitle(f"Library Card {app.card_number}")
    c.setAuthor("Central University Library")

    x = (page_w - CARD_W) / 2
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(page_w / 2, page_h - 28 * mm, "Central University Library — Student Library Card")
    c.setFillColor(GREY)
    c.setFont("Helvetica", 9)
    c.drawCentredString(page_w / 2, page_h - 34 * mm, "Print at 100% scale. Front and back are shown at actual card size.")

    front_y = page_h - 46 * mm - CARD_H
    back_y = front_y - 22 * mm - CARD_H
    _draw_front(c, app, x, front_y)
    _draw_back(c, app, x, back_y)

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(page_w / 2, front_y - 6 * mm, "FRONT")
    c.drawCentredString(page_w / 2, back_y - 6 * mm, "BACK")

    c.showPage()
    c.save()
    return buf.getvalue()
