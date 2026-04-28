"""
Update the CPI series in public/data/whisker_data.json using
jpcij@japan (Japan CPI index, NSA) from the haver-data repo.

Computes the 12-month percentage change from the raw index level.

Usage:
    python scripts/update_cpi.py --haver-data /path/to/haver-data
"""
import argparse
import json
from pathlib import Path

import pandas as pd


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--haver-data', required=True,
        help='Path to local clone of jasonzhixinglu/haver-data repo'
    )
    parser.add_argument(
        '--start', default=None,
        help='Trim CPI series to this start date YYYY-MM (default: match first whisker origin)'
    )
    args = parser.parse_args()

    parquet_path = Path(args.haver_data) / 'data' / 'data.parquet'
    if not parquet_path.exists():
        raise FileNotFoundError(f'Parquet file not found: {parquet_path}')

    # Load jpcij@japan index level
    df = pd.read_parquet(parquet_path)
    mask = df['code'] == 'jpcij@japan'
    if not mask.any():
        raise ValueError("Series 'jpcij@japan' not found in parquet file")

    cpi_index = (
        df[mask]
        .assign(date=lambda x: pd.to_datetime(x['date']))
        .sort_values('date')
        .set_index('date')['value']
    )

    # 12-month YoY % change
    cpi_yoy = ((cpi_index / cpi_index.shift(12)) - 1) * 100
    cpi_yoy = cpi_yoy.dropna()

    # Update whisker_data.json
    whisker_path = Path('public/data/whisker_data.json')
    with open(whisker_path) as f:
        data = json.load(f)

    # Determine start date: explicit arg, or match first whisker origin
    start = args.start or data['whiskers'][0]['origin']
    cpi_yoy = cpi_yoy[cpi_yoy.index >= pd.Timestamp(start)]

    cpi_series = [
        {'d': d.strftime('%Y-%m'), 'v': round(float(v), 4)}
        for d, v in cpi_yoy.items()
    ]

    old_last = data['cpi'][-1]
    data['cpi'] = cpi_series

    with open(whisker_path, 'w') as f:
        json.dump(data, f, separators=(',', ':'))

    new_last = cpi_series[-1]
    print(f"CPI updated: {old_last} -> {new_last}")
    print(f"Total observations: {len(cpi_series)}")
    print("Last 3 values:")
    for pt in cpi_series[-3:]:
        print(f"  {pt['d']}: {pt['v']:.4f}%")


if __name__ == '__main__':
    main()
