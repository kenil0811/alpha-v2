"""Draw one page of a PDF as a PNG with pdfium (which Docling brings), for showing where a value
was read from. Prints the page's size in points as JSON, so a piece's box can be marked on it."""

import json
import sys

import pypdfium2 as pdfium


def main(path: str, page: int, out: str, scale: float) -> None:
    pdf = pdfium.PdfDocument(path)
    p = pdf[page - 1]
    width, height = p.get_size()
    p.render(scale=scale).to_pil().save(out, format="PNG")
    print(json.dumps({"pages": len(pdf), "width": width, "height": height}))


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]), sys.argv[3], float(sys.argv[4]))
