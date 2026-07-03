#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scraper-cycling-translate.py
----------------------------
Traduit les descriptions + weather + publication_info du contenu scrapé cyclingstage.com
de EN vers FR (et autres langues) en utilisant le LLM z-ai.

Lit data/cycling/stage-favourites.json
Pour chaque stage, ajoute une clé "i18n" avec les traductions par langue.
Écrit data/cycling/stage-favourites-i18n.json

Usage:
    python3 scraper-cycling-translate.py                # traduit vers FR
    python3 scraper-cycling-translate.py --lang fr      # traduit vers FR
    python3 scraper-cycling-translate.py --lang fr,es   # traduit vers FR et ES
    python3 scraper-cycling-translate.py --force        # re-traduit même si déjà fait

Auteur: Équipe QA PARISCORE
"""

import argparse
import json
import os
import subprocess
import sys
import time

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_DIR = os.path.dirname(_SCRIPT_DIR)
INPUT_FILE = os.path.join(_REPO_DIR, "data", "cycling", "stage-favourites.json")
OUTPUT_FILE = os.path.join(_REPO_DIR, "data", "cycling", "stage-favourites-i18n.json")

# Langues supportées par PARISCORE
SUPPORTED_LANGS = {
    'fr': 'French',
    'es': 'Spanish',
    'de': 'German',
    'it': 'Italian',
    'nl': 'Dutch',
    'pt': 'Portuguese',
}


def translate_text(text, target_lang_name, target_lang_code):
    """Traduit un texte EN vers la langue cible via le CLI z-ai.
    Retourne le texte traduit ou None si échec.
    """
    if not text or not text.strip():
        return None
    
    system_prompt = (
        f"You are a professional sports translator specializing in cycling. "
        f"Translate the following English text to {target_lang_name}. "
        f"Keep technical cycling terms accurate (e.g., 'team time trial', 'GC', 'yellow jersey', "
        f"'punchy climbers', 'gradient'). "
        f"Preserve the structure (paragraphs, line breaks). "
        f"Return ONLY the translated text, no commentary."
    )
    
    # Échappe les quotes pour la ligne de commande
    # On utilise un fichier temporaire pour éviter les problèmes d'échappement
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
        f.write(text)
        temp_path = f.name
    
    try:
        cmd = [
            'z-ai', 'chat',
            '-s', system_prompt,
            '-p', f"Translate this English cycling text to {target_lang_name}:\n\n{text}",
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode != 0:
            print(f"    [WARN] z-ai retour code {result.returncode}", file=sys.stderr)
            if result.stderr:
                print(f"    stderr: {result.stderr[:200]}", file=sys.stderr)
            return None
        
        # Parse la sortie (JSON ou texte)
        output = result.stdout.strip()
        
        # Le CLI z-ai ajoute des lignes "🚀 ..." avant le JSON
        # On extrait juste la partie JSON
        json_start = output.find('{')
        if json_start == -1:
            # Pas de JSON, retourne texte brut si valide
            if output and len(output) > 10 and not output.startswith('🚀'):
                return output
            return None
        
        # Trouve la fin du JSON (dernier })
        json_str = output[json_start:]
        # Enlève les éventuels caractères après le dernier }
        last_brace = json_str.rfind('}')
        if last_brace != -1:
            json_str = json_str[:last_brace + 1]
        
        try:
            data = json.loads(json_str)
            if isinstance(data, dict):
                # Format: {"choices": [{"message": {"content": "..."}}]}
                if 'choices' in data and data['choices']:
                    content = data['choices'][0].get('message', {}).get('content', '')
                    if content:
                        return content.strip()
        except json.JSONDecodeError:
            pass
        
        return None
        
    except subprocess.TimeoutExpired:
        print(f"    [WARN] Timeout traduction", file=sys.stderr)
        return None
    except Exception as e:
        print(f"    [WARN] Erreur traduction: {e}", file=sys.stderr)
        return None
    finally:
        try:
            os.unlink(temp_path)
        except:
            pass


def translate_stage(stage_data, lang_code, lang_name, force=False):
    """Traduit les champs pertinents d'un stage vers la langue cible.
    Ajoute une entrée stage_data['i18n'][lang_code] = {description, weather, ...}
    """
    if 'i18n' not in stage_data:
        stage_data['i18n'] = {}
    
    if not force and lang_code in stage_data['i18n']:
        print(f"    [SKIP] Déjà traduit en {lang_code}")
        return stage_data
    
    translations = {}
    
    # 1. Title
    if stage_data.get('title'):
        print(f"    [TRAD] title EN→{lang_code}...")
        translated = translate_text(stage_data['title'], lang_name, lang_code)
        if translated:
            translations['title'] = translated
    
    # 2. Description (le plus long)
    if stage_data.get('description'):
        print(f"    [TRAD] description EN→{lang_code}...")
        translated = translate_text(stage_data['description'], lang_name, lang_code)
        if translated:
            translations['description'] = translated
    
    # 3. Weather forecast
    if stage_data.get('weather_forecast'):
        print(f"    [TRAD] weather EN→{lang_code}...")
        translated = translate_text(stage_data['weather_forecast'], lang_name, lang_code)
        if translated:
            translations['weather_forecast'] = translated
    
    # 4. Publication info (court, pas critique)
    if stage_data.get('publication_info'):
        print(f"    [TRAD] publication_info EN→{lang_code}...")
        translated = translate_text(stage_data['publication_info'], lang_name, lang_code)
        if translated:
            translations['publication_info'] = translated
    
    if translations:
        stage_data['i18n'][lang_code] = translations
        print(f"    [OK] {len(translations)} champs traduits en {lang_code}")
    else:
        print(f"    [FAIL] Aucune traduction réussie")
    
    return stage_data


def main():
    parser = argparse.ArgumentParser(description="Traduit les favouris cyclingstage vers FR et autres langues")
    parser.add_argument('--lang', type=str, default='fr',
                        help='Code langue(s) cible(s), séparés par virgule (défaut: fr)')
    parser.add_argument('--force', action='store_true',
                        help='Re-traduit même si déjà présent')
    args = parser.parse_args()
    
    target_langs = [l.strip().lower() for l in args.lang.split(',') if l.strip()]
    
    # Valide les langues
    invalid = [l for l in target_langs if l not in SUPPORTED_LANGS]
    if invalid:
        print(f"ERREUR: langue(s) non supportée(s): {invalid}")
        print(f"Langues supportées: {list(SUPPORTED_LANGS.keys())}")
        sys.exit(1)
    
    print(f"=== TRADUCTION VERS {target_langs} ===")
    
    if not os.path.exists(INPUT_FILE):
        print(f"ERREUR: {INPUT_FILE} introuvable. Lance d'abord scraper-cyclingstage-favourites.py")
        sys.exit(1)
    
    # Charge les données
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Stages à traduire: {len(data.get('stages', {}))}")
    print()
    
    # Pour chaque stage
    for stage_n, stage_data in data.get('stages', {}).items():
        if stage_data.get('status') != 'ok':
            print(f"[STAGE {stage_n}] SKIP (status={stage_data.get('status')})")
            continue
        
        print(f"[STAGE {stage_n}] {stage_data.get('title', '?')[:60]}...")
        
        for lang_code in target_langs:
            lang_name = SUPPORTED_LANGS[lang_code]
            translate_stage(stage_data, lang_code, lang_name, force=args.force)
            time.sleep(1)  # pause entre les langues
        
        print()
    
    # Sauvegarde
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    data['i18n_last_update'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    data['i18n_languages'] = target_langs
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"=== TERMINÉ ===")
    print(f"Fichier: {OUTPUT_FILE}")
    print(f"Stages traduits: {len(data.get('stages', {}))}")
    print(f"Langues: {target_langs}")


if __name__ == '__main__':
    main()
