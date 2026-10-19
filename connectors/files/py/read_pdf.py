"""Read a PDF with Docling into pieces with their places: each table cell with its table, row,
column, page and box, and each other piece of text with its page and box. Prints JSON."""

import json
import sys

from docling.document_converter import DocumentConverter


def box(b):
    return [round(b.l, 1), round(b.t, 1), round(b.r, 1), round(b.b, 1)] if b else None


def main(path: str) -> None:
    doc = DocumentConverter().convert(path).document
    pieces = []
    for n, table in enumerate(doc.tables, start=1):
        page = table.prov[0].page_no if table.prov else None
        for cell in table.data.table_cells:
            text = (cell.text or "").strip()
            if not text:
                continue
            pieces.append(
                {
                    "position": {
                        "page": page,
                        "table": n,
                        "row": cell.start_row_offset_idx + 1,
                        "column": cell.start_col_offset_idx + 1,
                        "box": box(cell.bbox),
                    },
                    "words": text,
                }
            )
    for item, _level in doc.iterate_items():
        text = (getattr(item, "text", None) or "").strip()
        if not text or not getattr(item, "prov", None):
            continue
        prov = item.prov[0]
        pieces.append({"position": {"page": prov.page_no, "box": box(prov.bbox)}, "words": text})
    print(json.dumps({"pages": len(doc.pages), "pieces": pieces}))


if __name__ == "__main__":
    main(sys.argv[1])
