# 20 October 2026: documents on rows, reading them, and files that come by mail

The plan "Plan: deal documents and email attachments" (a Claude Doc) had Kenil's yes for both
parts at 23:02 BST. What is generic is here; the first client's kits in their own repository.

- **Documents on rows (design §4):** migration 8 adds `row_files` (a file on a row, its kind, who
  put it there) and a table's `documents` (the kinds its rows take, from a kit's `documents:`).
  The world places and takes off files, journaled as filed; removing a row takes its files off.
  The row panel lists a row's files with their kind and takes a drop. Alpha's `file` tool places
  and takes off. An agent woken by a filing gets `alpha.input.filed`: each document filed or
  placed since it last looked, with its rows. Scripts gain `documents.place` and
  `documents.extract`.
- **Reading a document into values (design §9):** `files/reading.ts` asks the model once, with no
  tools and a JSON schema, for the values a script names; the wall (`holds`) keeps a value only
  when its number, words or year are in the piece it cites (a date like 4.30.26 counts). On the
  first client's seven files: 12k to 22k tokens and 15 to 25 seconds a file.
- **Two rules that came with it:** a connection's or reader's land never writes over a value a
  script computed (a deal's revenue from its documents stands over its listing's); a land may name
  a row by its id. A kit update that fails on a table name no longer leaves its files copied.
- **The page view (design §14):** `#/file/<hash>` shows a sheet with a cell marked, a PDF page drawn
  by pdfium (it comes with Docling) with a box marked, or a text with a line.
- **Files by mail (design §12):** a connector may say which items carry files and fetch them (Gmail:
  the Attachments field, by Message ID, read only). The intake starts when there is a mailbox and a
  table that takes documents, and takes each later email once: files kept for a look, the model
  proposing a row among those the email or files name (by a value only that row has) and a kind,
  a card per file. File it, Replace, Keep it in Alpha, Decline with a reason. Tried with two
  made-up emails on the test copy, real model: SB201's profile proposed on its deal, sure; Crest
  Hill's second profile offered Replace, filed and read by the Document reader.
- Not built: a journey on recorded mail (the intake is covered by tests on made-up mail and the
  test copy's try), looking back over older mail on asking, Word files, links in an email's body.
