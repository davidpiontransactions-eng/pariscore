#!/usr/bin/env python3
"""
train-mma-model.py — Calibrate MMA logistic regression coefficients (bd 8gz3)

Data: jansen88/ufc-data — complete_ufc_data.csv (30 ans UFC + 9 ans cotes)
Output: calibrated MMA_COEFS for services/mmaService.js + accuracy/ROI report

Usage: python tools/train-mma-model.py
"""

import urllib.request
import io
import sys
import json
import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, brier_score_loss
from sklearn.calibration import CalibratedClassifierCV

# --- Config ------------------------------------------------------------------
DATA_URL = (
    'https://raw.githubusercontent.com/jansen88/ufc-data/main/data/complete_ufc_data.csv'
)
LOCAL_CACHE = '.context/ufc_data_cache.csv'

# Feature columns (fighter1 - fighter2 differentials)
STAT_COLS = {
    'slpm':    ('fighter1_sig_strikes_landed_pm',         'fighter2_sig_strikes_landed_pm'),
    'str_acc': ('fighter1_sig_strikes_accuracy',           'fighter2_sig_strikes_accuracy'),
    'sapm':    ('fighter1_sig_strikes_absorbed_pm',        'fighter2_sig_strikes_absorbed_pm'),
    'str_def': ('fighter1_sig_strikes_defended',           'fighter2_sig_strikes_defended'),
    'td_avg':  ('fighter1_takedown_avg_per15m',            'fighter2_takedown_avg_per15m'),
    'td_acc':  ('fighter1_takedown_accuracy',              'fighter2_takedown_accuracy'),
    'td_def':  ('fighter1_takedown_defence',               'fighter2_takedown_defence'),
    'sub_avg': ('fighter1_submission_avg_attempted_per15m','fighter2_submission_avg_attempted_per15m'),
    'reach':   ('fighter1_reach',                          'fighter2_reach'),
}

# --- Load data ----------------------------------------------------------------
def load_data():
    # Try local cache first
    try:
        df = pd.read_csv(LOCAL_CACHE)
        print(f'  [cache] Loaded {len(df)} rows from {LOCAL_CACHE}')
        return df
    except FileNotFoundError:
        pass

    print(f'  [download] Fetching jansen88/ufc-data from GitHub...')
    try:
        req = urllib.request.Request(DATA_URL, headers={'User-Agent': 'PariScore/1.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode('utf-8')
        df = pd.read_csv(io.StringIO(raw))
        df.to_csv(LOCAL_CACHE, index=False, encoding='utf-8')
        print(f'  [download] {len(df)} rows cached to {LOCAL_CACHE}')
        return df
    except Exception as e:
        print(f'  [error] Download failed: {e}')
        sys.exit(1)

# --- Feature engineering ------------------------------------------------------
def build_features(df):
    """
    Dataset: fighter1 = ALWAYS winner. outcome in {fighter1, Draw, No contest}.
    Strategy: for each decisive bout, create 2 symmetric examples:
      - feats = f1_stats - f2_stats, y = 1  (f1 = winner perspective)
      - feats = f2_stats - f1_stats, y = 0  (f2 = loser perspective)
    This yields a balanced 50/50 dataset + forces symmetric coefficients.
    Model learns: positive diff -> more likely to win.
    """
    rows = []
    df = df.copy()

    for col in ['fighter1_dob', 'fighter2_dob']:
        df[col] = pd.to_datetime(df[col], errors='coerce')
    df['event_date'] = pd.to_datetime(df['event_date'], errors='coerce')

    def _make_row(row, winner_side):
        # winner_side=1: f1=winner, f2=loser  |  winner_side=2: f1=loser (flip)
        feats = {}
        sign = 1 if winner_side == 1 else -1

        for feat, (c1, c2) in STAT_COLS.items():
            v1 = pd.to_numeric(row.get(c1, np.nan), errors='coerce')
            v2 = pd.to_numeric(row.get(c2, np.nan), errors='coerce')
            feats[feat] = sign * (v1 - v2) if (pd.notna(v1) and pd.notna(v2)) else np.nan

        dob1 = row.get('fighter1_dob')
        dob2 = row.get('fighter2_dob')
        evdt = row.get('event_date')
        if pd.notna(dob1) and pd.notna(dob2) and pd.notna(evdt):
            age1 = (evdt - dob1).days / 365.25
            age2 = (evdt - dob2).days / 365.25
            feats['age'] = sign * (age1 - age2)
        else:
            feats['age'] = np.nan

        slpm1 = pd.to_numeric(row.get('fighter1_sig_strikes_landed_pm', np.nan), errors='coerce')
        slpm2 = pd.to_numeric(row.get('fighter2_sig_strikes_landed_pm', np.nan), errors='coerce')
        if pd.notna(slpm1) and pd.notna(slpm2):
            feats['finish_proxy'] = sign * (min(0.9, slpm1 / 5) - min(0.9, slpm2 / 5))
        else:
            feats['finish_proxy'] = np.nan

        feats['_y'] = 1 if winner_side == 1 else 0
        feats['_fav_odds'] = pd.to_numeric(row.get('favourite_odds', np.nan), errors='coerce')
        feats['_und_odds']  = pd.to_numeric(row.get('underdog_odds',  np.nan), errors='coerce')
        feats['_favourite'] = str(row.get('favourite', '')).lower().strip()
        feats['_fighter1']  = str(row.get('fighter1',  '')).lower().strip()
        feats['_winner_side'] = winner_side
        return feats

    for _, row in df.iterrows():
        outcome = str(row.get('outcome', '')).strip()
        if outcome != 'fighter1':
            continue  # Draw or No contest
        rows.append(_make_row(row, 1))  # winner perspective
        rows.append(_make_row(row, 2))  # loser perspective (flipped)

    feat_df = pd.DataFrame(rows)
    print(f'  [features] {len(feat_df)} examples from {len(feat_df)//2} decisive bouts (50/50 balanced)')
    return feat_df

# --- Train --------------------------------------------------------------------
FEATURE_COLS = list(STAT_COLS.keys()) + ['age', 'finish_proxy']

def train(feat_df):
    df = feat_df.dropna(subset=FEATURE_COLS + ['_y']).copy()
    print(f'  [train] {len(df)} rows after dropping NaN features')

    X = df[FEATURE_COLS].values
    y = df['_y'].values.astype(int)

    # Temporal split: last 20% as test (chronological, not random)
    split = int(len(df) * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    # Scale
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    # Logistic regression (L2, low C = stronger regularization)
    clf = LogisticRegression(C=0.5, max_iter=2000, solver='lbfgs', random_state=42)
    clf.fit(X_train_s, y_train)

    # Cross-val accuracy on training set
    cv_scores = cross_val_score(clf, X_train_s, y_train, cv=5, scoring='accuracy')
    print(f'  [cv] 5-fold accuracy: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}')

    # Test accuracy
    y_pred = clf.predict(X_test_s)
    y_prob = clf.predict_proba(X_test_s)[:, 1]
    acc = accuracy_score(y_test, y_pred)
    brier = brier_score_loss(y_test, y_prob)
    print(f'  [test] accuracy: {acc:.4f}  brier: {brier:.4f}  (n={len(y_test)})')

    return clf, scaler, X_test_s, y_test, y_prob, df.iloc[split:].copy(), acc, brier

# --- ROI simulation -----------------------------------------------------------
def simulate_roi(clf, scaler, X_test_s, y_test, y_prob, test_df):
    """
    Simulate on original examples only (winner_side==1).
    Model prob = P(fighter_A wins) where fighter_A = winner in dataset row.
    Bet 1 unit when EV > 5% vs market odds.
    """
    bets = 0
    wins = 0
    total_staked = 0.0
    total_return = 0.0

    for i, (prob, actual) in enumerate(zip(y_prob, y_test)):
        row = test_df.iloc[i]
        if row.get('_winner_side', 1) != 1:
            continue  # skip flipped examples

        fav_odds = pd.to_numeric(row.get('_fav_odds', np.nan), errors='coerce')
        und_odds  = pd.to_numeric(row.get('_und_odds',  np.nan), errors='coerce')
        is_fav_f1 = (str(row['_favourite']).strip() == str(row['_fighter1']).strip())

        # Odds for the actual winner (fighter1 in original rows)
        odds_win = fav_odds if is_fav_f1 else und_odds
        odds_los = und_odds if is_fav_f1 else fav_odds

        # Bet on winner (fighter1) if EV > 5%
        if pd.notna(odds_win) and odds_win > 1.01:
            ev = prob * (odds_win - 1) - (1 - prob)
            if ev > 0.05:
                bets += 1
                total_staked += 1.0
                total_return += odds_win  # fighter1 always wins in original rows
                wins += 1
        # Contrarian bet on loser if model heavily disagrees
        elif pd.notna(odds_los) and odds_los > 1.01:
            ev2 = (1 - prob) * (odds_los - 1) - prob
            if ev2 > 0.05:
                bets += 1
                total_staked += 1.0
                # fighter2 = loser → lose this bet

    roi = (total_return - total_staked) / total_staked * 100 if total_staked > 0 else 0
    print(f'  [roi]  bets={bets}  wins={wins}  staked={total_staked:.0f}  roi={roi:.2f}%')
    return roi, bets

# --- Extract unscaled coefficients -------------------------------------------
def extract_coefs(clf, scaler):
    """
    LogReg trains on scaled features -> unscale coefficients for raw-feature inference.
    coef_raw[i] = coef_scaled[i] / scale[i]
    intercept_raw = intercept - sum(coef_raw[i] * mean[i])
    """
    coef_s = clf.coef_[0]
    means  = scaler.mean_
    stds   = scaler.scale_

    coef_raw = coef_s / stds
    intercept_raw = clf.intercept_[0] - np.dot(coef_raw, means)

    result = {'intercept': float(intercept_raw)}
    for i, feat in enumerate(FEATURE_COLS):
        result[feat] = float(coef_raw[i])
    return result

# --- Main ---------------------------------------------------------------------
def main():
    print('\n=== MMA Model Training (bd 8gz3) ===\n')

    df = load_data()
    feat_df = build_features(df)
    clf, scaler, X_test_s, y_test, y_prob, test_df, acc, brier = train(feat_df)
    roi, bets = simulate_roi(clf, scaler, X_test_s, y_test, y_prob, test_df)
    coefs = extract_coefs(clf, scaler)

    print('\n--- Calibrated MMA_COEFS (copy -> services/mmaService.js) ---')
    print('const MMA_COEFS = {')
    print(f'  intercept:    {coefs["intercept"]: .6f},')
    for feat in FEATURE_COLS:
        print(f'  {feat:<14}: {coefs[feat]: .6f},')
    print('};')

    print(f'\n--- Summary ---')
    print(f'  Accuracy (test)  : {acc*100:.2f}%')
    print(f'  Brier score      : {brier:.4f}')
    print(f'  ROI simulation   : {roi:+.2f}% ({bets} bets)')
    print(f'  Dataset size     : {len(feat_df)} decisive bouts')

    # Write JSON output for easy consumption
    out = {
        'coefs': coefs,
        'accuracy_pct': round(acc * 100, 2),
        'brier': round(brier, 4),
        'roi_pct': round(roi, 2),
        'n_bets': bets,
        'n_bouts': len(feat_df),
    }
    with open('.context/mma-model-coefs.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2)
    print('\n  Saved: .context/mma-model-coefs.json')
    print('  Next: update MMA_COEFS in services/mmaService.js\n')

if __name__ == '__main__':
    main()
