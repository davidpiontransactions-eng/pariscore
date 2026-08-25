"""Extrait le texte des 2 theses PDF vers .context/*.txt (QA tennis top5)."""
import pypdf

for name in ["thesis-dryja", "thesis-willekes"]:
    src = f".context/{name}.pdf"
    dst = f".context/{name}.txt"
    try:
        r = pypdf.PdfReader(src)
        txt = "\n".join((p.extract_text() or "") for p in r.pages)
        with open(dst, "w", encoding="utf-8") as f:
            f.write(txt)
        print(name, "chars:", len(txt))
    except Exception as e:
        print(name, "ERR:", e)
