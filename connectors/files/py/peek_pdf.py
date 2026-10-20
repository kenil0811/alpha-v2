"""The words of a PDF's first pages, with pdfium (which Docling brings), for a quick look at what a
file is before it is filed and read in full. Prints JSON."""

import json
import sys

import pypdfium2 as pdfium


def main(path: str, pages: int) -> None:
    pdf = pdfium.PdfDocument(path)
    words = []
    for n in range(min(pages, len(pdf))):
        words.append(pdf[n].get_textpage().get_text_range())
    print(json.dumps({"pages": len(pdf), "words": words}))


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]))
