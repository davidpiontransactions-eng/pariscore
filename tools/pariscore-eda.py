"""
PariScore EDA toolkit — local dev + server integration
Venv: .venv-data/Scripts/python.exe (Python 3.11)

Usage (CLI):
  python tools/pariscore-eda.py --mode profile --table player_surface_scores
  python tools/pariscore-eda.py --mode dtale   --table archive_matches --port 40000
  python tools/pariscore-eda.py --mode chat    --table player_surface_scores --question "meilleur SPS clay?"

All modes output JSON to stdout (for server.js _spawnEDA integration).
"""

import sys
import json
import os
import sqlite3
import argparse

DB_PATH = os.environ.get('PARISCORE_DB', 'pariscore.db')


def load_table(table: str):
    import pandas as pd
    con = sqlite3.connect(DB_PATH)
    df = pd.read_sql(f"SELECT * FROM {table}", con)
    con.close()
    return df


def list_tables() -> list:
    con = sqlite3.connect(DB_PATH)
    cur = con.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [r[0] for r in cur.fetchall()]
    con.close()
    return tables


# ── fg-data-profiling ────────────────────────────────────────────────────────
def run_profile(table: str, output: str, minimal: bool = True) -> dict:
    from data_profiling import ProfileReport
    df = load_table(table)
    report = ProfileReport(
        df,
        title=f"PariScore — {table}",
        explorative=not minimal,
        minimal=minimal,
    )
    os.makedirs(os.path.dirname(output), exist_ok=True)
    report.to_file(output)
    return {
        'ok': True,
        'rows': len(df),
        'cols': len(df.columns),
        'path': output,
        'url': f'/eda/profile/{table}',
    }


# ── D-Tale ───────────────────────────────────────────────────────────────────
def run_dtale(table: str, port: int = 40000) -> dict:
    import dtale
    df = load_table(table)
    # subprocess=True → Flask runs in background thread, Python process stays alive
    d = dtale.show(df, host='localhost', port=port, subprocess=True, open_browser=False)
    url = f'http://localhost:{port}/dtale/main/1'
    return {'ok': True, 'url': url, 'rows': len(df), 'cols': len(df.columns)}


# ── PandasAI ─────────────────────────────────────────────────────────────────
def run_chat(table: str, question: str) -> dict:
    api_key = os.environ.get('OPENAI_API_KEY') or os.environ.get('PANDASAI_API_KEY')
    if not api_key:
        return {'ok': False, 'error': 'OPENAI_API_KEY manquante dans .env'}

    from pandasai import SmartDataframe
    from pandasai.llm import OpenAI

    df = load_table(table)
    llm = OpenAI(api_token=api_key)
    sdf = SmartDataframe(df, config={'llm': llm, 'save_charts': False, 'verbose': False})
    result = sdf.chat(question)
    return {'ok': True, 'answer': str(result), 'table': table, 'question': question}


# ── Tables list ──────────────────────────────────────────────────────────────
def run_tables() -> dict:
    return {'ok': True, 'tables': list_tables()}


# ── CLI entry ────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='PariScore EDA toolkit')
    parser.add_argument('--mode', choices=['profile', 'dtale', 'chat', 'tables'], default='profile')
    parser.add_argument('--table', default='player_surface_scores')
    parser.add_argument('--output', default='.context/eda_profile.html')
    parser.add_argument('--question', default='')
    parser.add_argument('--port', type=int, default=40000)
    parser.add_argument('--full', action='store_true', help='Full (non-minimal) profiling')
    args = parser.parse_args()

    try:
        if args.mode == 'profile':
            output = args.output if args.output != '.context/eda_profile.html' else f'.context/eda_profile_{args.table}.html'
            result = run_profile(args.table, output, minimal=not args.full)
        elif args.mode == 'dtale':
            import time
            result = run_dtale(args.table, args.port)
            # Print JSON early so CLI callers get the URL; Node.js detached spawn uses stdio:ignore
            print(json.dumps(result, ensure_ascii=False))
            sys.stdout.flush()
            time.sleep(7200)  # keep process alive — D-Tale Flask thread lives here
            sys.exit(0)
        elif args.mode == 'chat':
            if not args.question:
                result = {'ok': False, 'error': '--question requis pour mode chat'}
            else:
                result = run_chat(args.table, args.question)
        elif args.mode == 'tables':
            result = run_tables()
        else:
            result = {'ok': False, 'error': f'Mode inconnu: {args.mode}'}

        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'ok': False, 'error': str(e)}, ensure_ascii=False))
        sys.exit(1)
