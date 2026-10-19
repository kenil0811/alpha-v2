"""Spike: what Docling gives for a PDF: text items and table cells with page and box."""
import json
import sys
import time

from docling.document_converter import DocumentConverter

path = sys.argv[1]
t0 = time.time()
doc = DocumentConverter().convert(path).document
print(f"converted in {time.time() - t0:.1f}s, pages={len(doc.pages)}")
items = []
for item, _level in doc.iterate_items():
    prov = item.prov[0] if getattr(item, "prov", None) else None
    text = getattr(item, "text", None)
    if prov is None:
        continue
    box = prov.bbox
    items.append(
        {
            "label": str(item.label),
            "page": prov.page_no,
            "box": [round(box.l, 1), round(box.t, 1), round(box.r, 1), round(box.b, 1)],
            "text": (text or "")[:80],
        }
    )
print(f"items with places: {len(items)}")
for i in items[:12]:
    print(json.dumps(i))
tables = doc.tables
print(f"tables: {len(tables)}")
for t in tables[:2]:
    cells = t.data.table_cells
    print(f"  table on page {t.prov[0].page_no}: {t.data.num_rows} rows x {t.data.num_cols} cols, {len(cells)} cells")
    for c in cells[:8]:
        b = c.bbox
        print(
            "   ",
            json.dumps(
                {
                    "row": c.start_row_offset_idx,
                    "col": c.start_col_offset_idx,
                    "text": c.text[:40],
                    "box": [round(b.l, 1), round(b.t, 1), round(b.r, 1), round(b.b, 1)] if b else None,
                }
            ),
        )
