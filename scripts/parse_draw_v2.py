import pdfplumber
import json
import re

def extract_full_text(pdf_path):
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
    return text

KNOWN_COUNTRIES = {
    'ARG', 'AUS', 'AUT', 'BEL', 'BIH', 'BLR', 'BUL', 'CAN', 'CHI', 'CHN',
    'COL', 'CRO', 'CZE', 'DEN', 'ECU', 'EGY', 'ESP', 'EST', 'FRA', 'GBR', 'GEO',
    'GER', 'GRE', 'HKG', 'HUN', 'INA', 'IND', 'IOT', 'IRL', 'ISL', 'ISR', 'ITA',
    'JPN', 'KAZ', 'KHV', 'KOR', 'KOS', 'LAT', 'LTU', 'LUX', 'MAR', 'MDA', 'MEX',
    'MKD', 'MLI', 'MON', 'NED', 'NGR', 'NOR', 'NZL', 'PAR', 'PER', 'PHI',
    'POL', 'POR', 'ROU', 'RSA', 'RUS', 'SAF', 'SUI', 'SVK', 'SLO', 'SRB', 'SWE',
    'TCH', 'THA', 'TUN', 'TUR', 'UKR', 'USA', 'UZB', 'VEN', 'ZIM'
}

SKIP_PATTERNS = [
    'US Open', "Men's", "Women's", 'CITY, COUNTRY', 'New York',
    'MAIN DRAW', 'Round of', 'SEEDED PLAYERS', 'PRIZE MONEY',
    'Points', 'RETIREMENTS', 'TNNSLIVE.COM', 'Free live',
    'Winner', 'Finalist', 'Semi-Finalist', 'Quarter-Finalist',
    'Round of 16', 'Round of 32', 'Round of 64', 'Round of 128',
    'Draw continues'
]

def clean_name(name_raw):
    name_raw = name_raw.strip()
    if name_raw.endswith(' CHAMPION'):
        name_raw = name_raw[:-9]
    return name_raw

def parse_draw(text):
    players = []
    lines = text.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if any(skip in line for skip in SKIP_PATTERNS):
            continue
        
        # Pattern 1: position [seed] [status] country name
        match = re.match(
            r'^(\d+)\s+'
            r'(?:(\d+)\s+)?'
            r'(?:(Q|WC|LL)\s+)?'
            r'([A-Z]{2,3})\s+'
            r'(.+)$',
            line
        )
        
        if match:
            country = match.group(4)
            if country not in KNOWN_COUNTRIES:
                match = None
        
        if not match:
            # Pattern 2: position [seed] [status] name (no country)
            # Use flexible name pattern that allows mixed case
            name_pattern = r'([A-Z][A-Za-z\s,\'-]+)'
            match = re.match(
                r'^(\d+)\s+'
                r'(?:(\d+)\s+)?'
                r'(?:(Q|WC|LL)\s+)?'
                + name_pattern + r'$',
                line
            )
        
        if not match:
            continue
        
        pos = int(match.group(1))
        seed = int(match.group(2)) if match.group(2) else None
        status = match.group(3)
        
        if match.group(4) in KNOWN_COUNTRIES:
            country = match.group(4)
            name_raw = clean_name(match.group(5))
        else:
            country = None
            name_raw = clean_name(match.group(4))
        
        if ',' in name_raw:
            parts = name_raw.split(',', 1)
            last_name = parts[0].strip()
            first_name = parts[1].strip()
        else:
            last_name = name_raw
            first_name = ""
        
        player = {
            'position': pos,
            'name': f"{first_name} {last_name}".strip() if first_name else last_name,
            'lastName': last_name,
            'firstName': first_name,
            'country': country,
            'seed': seed,
            'qualifier': status == 'Q',
            'wildcard': status == 'WC',
            'luckyLoser': status == 'LL',
            'roundReached': 'R128'
        }
        
        players.append(player)
    
    return players

def main():
    men_text = extract_full_text('men_draw.pdf')
    men_players = parse_draw(men_text)
    
    women_text = extract_full_text('women_draw.pdf')
    women_players = parse_draw(women_text)
    
    output = {
        'tournament': 'US Open 2026',
        'surface': 'Hard',
        'location': 'New York, USA',
        'dates': 'August 30 - September 13, 2026',
        'men': men_players,
        'women': women_players
    }
    
    with open('us_open_draw_2026.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"Men's draw: {len(men_players)} players")
    print(f"Women's draw: {len(women_players)} players")
    print("Saved to us_open_draw_2026.json")
    
    for label, players in [("MEN", men_players), ("WOMEN", women_players)]:
        positions = sorted([p['position'] for p in players])
        expected = list(range(1, 129))
        missing = set(expected) - set(positions)
        if missing:
            print(f"\n{label} missing positions: {sorted(missing)}")

if __name__ == '__main__':
    main()
