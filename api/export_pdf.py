# api/export_pdf.py
# Generates a professional A4 Bill of Quantities PDF using ReportLab Platypus.
#
# ReportLab Platypus is a high-level layout engine.  Think of it like RDLC / SSRS
# in .NET: you describe a list of "flowables" (paragraphs, tables, spacers) and
# the engine arranges them on pages, inserting page breaks as needed.
#
# Two layers exist in ReportLab:
#   1. Canvas   — low-level drawing API (lines, text at exact x,y coordinates)
#   2. Platypus — high-level "flowable" layout engine built on top of Canvas
# This file uses Platypus for the table/paragraphs and drops to Canvas only for
# the page header and footer that must appear at a fixed position on every page.

import io                               # in-memory byte buffer — like MemoryStream in C#
from datetime import date               # date.today() — like DateTime.Today in C#

from reportlab.platypus import (
    SimpleDocTemplate,   # manages pages, margins, and the flowables list
    Table,               # renders a 2-D grid of cells
    TableStyle,          # a collection of formatting rules applied to a Table
    Paragraph,           # a styled, word-wrapping block of text
    Spacer,              # inserts blank vertical space — like an empty panel in a layout
    HRFlowable,          # draws a horizontal rule (like <hr> in HTML)
)
from reportlab.lib.pagesizes import A4  # A4 = (595.28, 841.89) points; 1 pt = 1/72 inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle  # CSS-like text styles
from reportlab.lib.units import mm      # 1*mm = 2.8346 points; use to specify sizes in mm
from reportlab.lib import colors        # named colour constants and Color() constructor
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT  # text-alignment enum values

# ── Page geometry ─────────────────────────────────────────────────────────────────────
# All measurements in points (pts).  1 mm = 2.8346 pts.
PAGE_W, PAGE_H = A4                         # unpack the tuple — like a C# value tuple
LEFT_M  = RIGHT_M = 20 * mm                # 20 mm side margins
TOP_M   = 30 * mm                          # tall top margin leaves room for the drawn header
BOT_M   = 18 * mm                          # bottom margin leaves room for the drawn footer
CONTENT_W = PAGE_W - LEFT_M - RIGHT_M      # usable line width ≈ 482 pts (170 mm)

# Table column widths must sum to CONTENT_W.
# Description gets whatever remains after the fixed numeric columns are allocated.
_C_QTY   = 38                              # Qty — narrow; right-aligned
_C_UNIT  = 34                              # Unit — narrow; centred
_C_MAT   = 58                              # Mat Rate — right-aligned £
_C_LAB   = 58                              # Lab Rate — right-aligned £
_C_TOTAL = 64                              # Total — slightly wider for large £ values
_C_DESC  = CONTENT_W - _C_QTY - _C_UNIT - _C_MAT - _C_LAB - _C_TOTAL  # remainder ≈ 230 pts
COL_WIDTHS = [_C_DESC, _C_QTY, _C_UNIT, _C_MAT, _C_LAB, _C_TOTAL]     # used by Table()

# Column index constants — makes style rules readable instead of magic numbers
_I_DESC, _I_QTY, _I_UNIT, _I_MAT, _I_LAB, _I_TOTAL = range(6)


# ── Helpers ───────────────────────────────────────────────────────────────────────────

def _fmt(n) -> str:
    """Format a number as UK sterling with comma thousands separator.
    Equivalent to n.ToString("C", new CultureInfo("en-GB")) in C#."""
    return f"£{float(n):,.2f}"          # £ = £ (avoids encoding issues in source)


def _normalise_boq(boq_json):
    """Convert any Claude JSON shape to a list of (trade_name, [item_dict]) tuples.
    Mirrors normaliseBoq() in the React front end and _enrich_boq() in app.py."""
    if isinstance(boq_json, list):           # shape: [{trade, items}]
        groups = boq_json
    elif isinstance(boq_json, dict):
        if 'bill_of_quantities' in boq_json: # shape: {bill_of_quantities: [...]}
            groups = boq_json['bill_of_quantities']
        elif 'trades' in boq_json:           # shape: {trades: [...]}
            groups = boq_json['trades']
        else:                                # shape: {groundworks: [...], brickwork: [...]}
            groups = [{'trade': k, 'items': v}
                      for k, v in boq_json.items() if isinstance(v, list)]
    else:
        groups = []                          # unknown shape — return empty; caller handles gracefully

    result = []
    for g in groups:
        trade = g.get('trade') or g.get('name') or 'General'
        items = g.get('items') or g.get('line_items') or []
        result.append((trade, items))        # each element is a 2-tuple — like a ValueTuple in C#
    return result


# ── Paragraph style factory ───────────────────────────────────────────────────────────
# Styles are like CSS classes: define once, apply repeatedly.
# getSampleStyleSheet() returns a dict of built-in ReportLab styles.
_BASE = getSampleStyleSheet()

def _style(name, *, parent='Normal', font='Helvetica', size=8.5, leading=12,
           align=TA_LEFT, color=colors.black, bold=False):
    """One-liner helper for creating a named ParagraphStyle — avoids repetition."""
    return ParagraphStyle(
        name,
        parent=_BASE[parent],
        fontName='Helvetica-Bold' if bold else font,
        fontSize=size,
        leading=leading,                     # line height; leading < fontSize causes overlap
        alignment=align,
        textColor=color,
    )

# All styles used in the document defined here so the table-building loop stays clean
S_NORMAL        = _style('BoqNormal')
S_BOLD          = _style('BoqBold',     bold=True)
S_RIGHT         = _style('BoqRight',    align=TA_RIGHT)
S_RIGHT_BOLD    = _style('BoqRightBold',align=TA_RIGHT, bold=True)
S_CENTER        = _style('BoqCenter',   align=TA_CENTER)
S_COL_HDR       = _style('BoqColHdr',  bold=True, color=colors.white)          # black-bg row
S_COL_HDR_R     = _style('BoqColHdrR', bold=True, color=colors.white, align=TA_RIGHT)
S_COL_HDR_C     = _style('BoqColHdrC', bold=True, color=colors.white, align=TA_CENTER)
S_TRADE         = _style('BoqTrade',   bold=True, size=9.5, leading=14)        # trade section
S_DISCLAIMER    = _style('BoqDisc',    font='Helvetica-Oblique', size=7,
                          color=colors.Color(0.4, 0.4, 0.4))

# Light greys — these are still "black and white" (monochromatic), just different shades
_GREY_TRADE = colors.Color(0.91, 0.91, 0.91)   # trade section header background
_GREY_ALT   = colors.Color(0.97, 0.97, 0.97)   # alternating item row shading
_GREY_LINE  = colors.Color(0.75, 0.75, 0.75)   # inner grid line colour


# ── Main function ─────────────────────────────────────────────────────────────────────

def generate_boq_pdf(boq_json: dict) -> bytes:
    """Generate a professional A4 Bill of Quantities PDF and return it as raw bytes.

    The caller can write the bytes to disk, store them in cloud storage, or send
    them directly to the browser — equivalent to returning a byte[] in C# and then
    using File(bytes, "application/pdf", "filename.pdf") in an MVC controller.

    Args:
        boq_json: priced BoQ dict returned by /process.  Accepts all common shapes
                  (list of trade objects, keyed dict, or wrapper dict).

    Returns:
        Raw PDF bytes.  Raises ValueError if boq_json contains no trade data.
    """
    # ── Validate input ────────────────────────────────────────────────────────────
    trade_groups = _normalise_boq(boq_json)
    if not trade_groups:                    # guard — like ArgumentException in C#
        raise ValueError("boq_json contains no recognisable trade groups.")

    # ── Output buffer ─────────────────────────────────────────────────────────────
    buf = io.BytesIO()                      # write PDF bytes here; like new MemoryStream()

    # ── Date string captured once at call time ────────────────────────────────────
    d = date.today()
    today_str = f"{d.day} {d.strftime('%B %Y')}"   # e.g. "6 June 2026" — no leading zero

    # ── Page header / footer callback ─────────────────────────────────────────────
    # SimpleDocTemplate calls this function after rendering each page.
    # We use the low-level canvas API here because headers/footers must be drawn
    # at exact coordinates outside the flowing content area — like overriding
    # OnRenderPage in a C# ReportViewer or PdfWriter.GetDirectContent() in iTextSharp.
    def _draw_chrome(canvas, doc):
        canvas.saveState()                  # push graphics state — like Graphics.Save() in GDI+

        # ── Header ────────────────────────────────────────────────────────────────
        y_title = PAGE_H - TOP_M + 13 * mm  # Y baseline for the title text

        canvas.setFont('Helvetica-Bold', 16)
        canvas.setFillColor(colors.black)
        canvas.drawString(LEFT_M, y_title, 'Vulcan Quanta')            # left-aligned company name

        canvas.setFont('Helvetica', 8.5)
        canvas.drawRightString(PAGE_W - RIGHT_M, y_title, today_str)  # right-aligned date

        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.Color(0.3, 0.3, 0.3))
        canvas.drawString(LEFT_M, y_title - 12, 'Bill of Quantities — AI Draft')

        # Horizontal rule separating header from body
        rule_y = PAGE_H - TOP_M + 4 * mm
        canvas.setStrokeColor(colors.black)
        canvas.setLineWidth(0.8)
        canvas.line(LEFT_M, rule_y, PAGE_W - RIGHT_M, rule_y)

        # Page number — right-aligned just below the rule
        canvas.setFont('Helvetica', 7.5)
        canvas.setFillColor(colors.black)
        canvas.drawRightString(PAGE_W - RIGHT_M, rule_y - 8, f'Page {doc.page}')

        # ── Footer ────────────────────────────────────────────────────────────────
        footer_rule_y = BOT_M - 4 * mm
        canvas.setLineWidth(0.5)
        canvas.setStrokeColor(colors.Color(0.5, 0.5, 0.5))
        canvas.line(LEFT_M, footer_rule_y, PAGE_W - RIGHT_M, footer_rule_y)

        canvas.setFont('Helvetica-Oblique', 7.5)
        canvas.setFillColor(colors.Color(0.35, 0.35, 0.35))
        canvas.drawCentredString(                                       # note: ReportLab uses "Centred" not "Centered"
            PAGE_W / 2,
            footer_rule_y - 9,
            'AI-generated draft. Professional review required before issue.',
        )

        canvas.restoreState()              # pop graphics state — like Graphics.Restore()

    # ── Document ──────────────────────────────────────────────────────────────────
    doc = SimpleDocTemplate(
        buf,                               # output target: our in-memory buffer
        pagesize=A4,
        leftMargin=LEFT_M,
        rightMargin=RIGHT_M,
        topMargin=TOP_M,                   # reserved for the drawn header
        bottomMargin=BOT_M,               # reserved for the drawn footer
        title='Bill of Quantities',
        author='Vulcan Quanta',
    )

    # ── Build the table rows ──────────────────────────────────────────────────────
    # We build ONE large table for the entire BoQ rather than one table per trade.
    # This keeps all columns perfectly aligned across trade sections.
    # all_rows: list[list[Paragraph|str]] — one inner list per table row
    # row_cmds: list[tuple] — TableStyle commands collected row-by-row
    all_rows  = []
    row_cmds  = []

    # ── Column header row (row 0) ─────────────────────────────────────────────────
    all_rows.append([
        Paragraph('Description',   S_COL_HDR),    # left-aligned on black background
        Paragraph('Qty',           S_COL_HDR_R),
        Paragraph('Unit',          S_COL_HDR_C),
        Paragraph('Mat Rate',      S_COL_HDR_R),
        Paragraph('Lab Rate',      S_COL_HDR_R),
        Paragraph('Total',         S_COL_HDR_R),
    ])
    row_cmds += [
        ('BACKGROUND',    (0, 0), (-1, 0), colors.black),   # black background for header row
        ('TOPPADDING',    (0, 0), (-1, 0), 6),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
    ]

    # ── Trade sections ────────────────────────────────────────────────────────────
    grand_subtotal = 0.0                   # running total across all trades

    for trade_name, items in trade_groups:

        # Trade header row — spans all columns to act as a section divider
        tr = len(all_rows)                 # current row index ("tr" for trade row)
        all_rows.append([
            Paragraph(trade_name.upper(), S_TRADE),
            '', '', '', '', '',            # empty strings occupy the remaining cells
        ])
        row_cmds += [
            ('SPAN',          (0, tr), (-1, tr)),              # merge all 6 cells into one
            ('BACKGROUND',    (0, tr), (-1, tr), _GREY_TRADE),
            ('LINEABOVE',     (0, tr), (-1, tr), 0.8, colors.black),   # strong line above each trade
            ('TOPPADDING',    (0, tr), (-1, tr), 5),
            ('BOTTOMPADDING', (0, tr), (-1, tr), 5),
        ]

        # Line items
        trade_total = 0.0                  # running total for this trade only

        for item in items:
            desc     = item.get('description') or item.get('desc') or ''
            qty      = float(item.get('quantity') or item.get('qty') or 0)
            unit     = item.get('unit') or ''
            mat      = float(item.get('material_rate') or 0)
            lab      = float(item.get('labour_rate')   or 0)
            # Use stored line_total if present; otherwise compute from rates × qty.
            # item.get('line_total') returns None if the key is missing.
            stored   = item.get('line_total')
            line_tot = float(stored) if stored is not None else (mat + lab) * qty

            trade_total += line_tot        # accumulate

            ir = len(all_rows)             # item row index
            all_rows.append([
                Paragraph(desc,             S_NORMAL),  # wraps automatically if long
                Paragraph(f'{qty:g}',       S_RIGHT),   # :g strips trailing zeros (3.0 → "3")
                Paragraph(unit,             S_CENTER),
                Paragraph(_fmt(mat),        S_RIGHT),
                Paragraph(_fmt(lab),        S_RIGHT),
                Paragraph(_fmt(line_tot),   S_RIGHT),
            ])
            # Alternate row tinting every other item row (not counting headers/subtotals)
            if ir % 2 == 0:
                row_cmds.append(('BACKGROUND', (0, ir), (-1, ir), _GREY_ALT))

        grand_subtotal += trade_total

        # Trade subtotal row — description spans cols 0-4, total in col 5
        sr = len(all_rows)                 # subtotal row index
        all_rows.append([
            Paragraph(f'Subtotal — {trade_name}', S_RIGHT_BOLD),
            '', '', '', '',                # empty: absorbed by the SPAN below
            Paragraph(_fmt(trade_total),   S_RIGHT_BOLD),
        ])
        row_cmds += [
            ('SPAN',          (0, sr), (_I_LAB, sr)),          # merge description through lab-rate cell
            ('LINEABOVE',     (0, sr), (-1, sr), 0.5, colors.black),
            ('TOPPADDING',    (0, sr), (-1, sr), 4),
            ('BOTTOMPADDING', (0, sr), (-1, sr), 6),
        ]

    # ── Totals section ────────────────────────────────────────────────────────────
    contingency     = grand_subtotal * 0.10          # 10 % risk allowance
    grand_total_inc = grand_subtotal + contingency   # final figure including contingency

    # Works subtotal (sum of all trades before contingency)
    wr = len(all_rows)
    all_rows.append([
        Paragraph('Works subtotal', S_RIGHT_BOLD),
        '', '', '', '',
        Paragraph(_fmt(grand_subtotal), S_RIGHT_BOLD),
    ])
    row_cmds += [
        ('SPAN',      (0, wr), (_I_LAB, wr)),
        ('LINEABOVE', (0, wr), (-1, wr), 1.2, colors.black),  # heavier rule before totals
        ('TOPPADDING',    (0, wr), (-1, wr), 7),
        ('BOTTOMPADDING', (0, wr), (-1, wr), 4),
    ]

    # Contingency line
    cr = len(all_rows)
    all_rows.append([
        Paragraph('Contingency / risk allowance (10%)', S_RIGHT),
        '', '', '', '',
        Paragraph(_fmt(contingency), S_RIGHT),
    ])
    row_cmds += [
        ('SPAN',          (0, cr), (_I_LAB, cr)),
        ('TOPPADDING',    (0, cr), (-1, cr), 3),
        ('BOTTOMPADDING', (0, cr), (-1, cr), 3),
    ]

    # Grand total (the headline figure)
    gr = len(all_rows)
    all_rows.append([
        Paragraph('GRAND TOTAL (excluding VAT)', S_RIGHT_BOLD),
        '', '', '', '',
        Paragraph(_fmt(grand_total_inc), S_RIGHT_BOLD),
    ])
    row_cmds += [
        ('SPAN',          (0, gr), (_I_LAB, gr)),
        ('LINEABOVE',     (0, gr), (-1, gr), 1.5, colors.black),
        ('LINEBELOW',     (0, gr), (-1, gr), 1.5, colors.black),
        ('TOPPADDING',    (0, gr), (-1, gr), 7),
        ('BOTTOMPADDING', (0, gr), (-1, gr), 7),
    ]

    # ── Assemble the TableStyle ───────────────────────────────────────────────────
    # TableStyle takes a list of (command, start_cell, end_cell, *args) tuples.
    # Cells are referenced as (col, row) — note: column first, like (x, y) coordinates.
    # (-1, -1) means the last column and last row respectively.
    base_cmds = [
        ('FONT',       (0, 0), (-1, -1), 'Helvetica', 8.5),  # default font for all cells
        ('LEADING',    (0, 0), (-1, -1), 12),                 # default line height
        # Outer border of the whole table
        ('BOX',        (0, 0), (-1, -1), 0.8, colors.black),
        # Light inner grid lines between all cells
        ('INNERGRID',  (0, 0), (-1, -1), 0.25, _GREY_LINE),
        # Default padding for all cells
        ('TOPPADDING',    (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING',   (0, 0), (-1, -1), 5),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 5),
        # Vertical alignment — middle of cell height
        ('VALIGN',     (0, 0), (-1, -1), 'MIDDLE'),
        # Default horizontal alignment — columns 1-5 right, col 2 (Unit) centred
        ('ALIGN',      (_I_QTY, 0),  (-1, -1),        'RIGHT'),
        ('ALIGN',      (_I_UNIT, 0), (_I_UNIT, -1),   'CENTER'),
    ]
    # Merge base commands with the per-row commands accumulated above.
    # TableStyle processes commands in order; later commands override earlier ones.
    table_style = TableStyle(base_cmds + row_cmds)

    # ── Create Table ──────────────────────────────────────────────────────────────
    boq_table = Table(
        all_rows,
        colWidths=COL_WIDTHS,
        repeatRows=1,       # re-draw row 0 (column headers) at the top of every new page
        splitByRow=True,    # allow the table to split at row boundaries across pages
        hAlign='LEFT',
    )
    boq_table.setStyle(table_style)

    # ── Story (the flowables list) ────────────────────────────────────────────────
    # "Story" is the ReportLab term for the ordered list of flowables.
    # Think of it as the content of a vertical StackPanel in WPF.
    story = [boq_table]

    # Disclaimer paragraph below the table
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph(
        'Rates sourced from BCIS Q2 2025–2026 regional averages and Spon’s '
        'Architects’ & Builders’ Price Book 2025. '
        'Subject to market variation, location, and supplier pricing. '
        'Professional quantity surveyor review recommended before tender or client issue.',
        S_DISCLAIMER,
    ))

    # ── Build the PDF ─────────────────────────────────────────────────────────────
    # doc.build() places flowables onto pages, fires _draw_chrome on each page,
    # and writes the completed PDF into buf.
    doc.build(
        story,
        onFirstPage=_draw_chrome,    # callback fired after the first page is rendered
        onLaterPages=_draw_chrome,   # callback fired after each subsequent page
    )

    return buf.getvalue()            # return raw bytes — like buf.ToArray() in C#
