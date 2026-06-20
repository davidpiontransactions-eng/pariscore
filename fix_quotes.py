import pathlib, sys
root = pathlib.Path(sys.argv[1])
for f in sorted(root.iterdir()):
    if f.suffix == '.py':
        content = f.read_text(encoding='utf-8')
        old = content
        # Fix: remove backslash before triple quotes
        content = content.replace('\\"', '"')
        if content != old:
            f.write_text(content, encoding='utf-8')
            print(f'Fixed: {f.name}')
        else:
            print(f'OK: {f.name}')
