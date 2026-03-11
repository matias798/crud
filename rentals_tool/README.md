# Rental listing evaluator (local JSON tool)

This tool reads local rental listings from `raw_listings.json`, normalizes the data, computes deterministic metrics + flags, and writes `rentals_for_chatgpt.json` for manual upload to ChatGPT.

## 1) Edit the input file

Create or update `raw_listings.json` in the **repository root** as a JSON array.

Example:

```json
[
  {
    "id": "home-001",
    "title": "2-værelses i Glostrup",
    "area": "Glostrup",
    "address": "Examplevej 10",
    "size_m2": 52,
    "rooms": 2,
    "monthly_rent_dkk": 11800,
    "monthly_aconto_dkk": 700,
    "monthly_other_fees_dkk": 0,
    "deposit_dkk": 35400,
    "prepaid_rent_months": 1,
    "move_in_fee_dkk": 1000,
    "allows_cpr": true,
    "commute_to_kbh_h_min": 24,
    "notes": "Close to S-train"
  }
]
```

Notes:
- Missing numeric fields default to `0`.
- Missing commute defaults to `999` minutes.
- `allows_cpr` can be `true/false`, `"yes"/"no"`, or omitted.

## 2) Run the script

From repo root:

```bash
python3 rentals_tool/evaluate_rentals.py
```

This writes `rentals_for_chatgpt.json` in the repo root.

## 3) Example ChatGPT prompt

After uploading `rentals_for_chatgpt.json`, you can use:

```text
Please analyze these Copenhagen-area rental listings for a 2-adult household.
Prioritize best value for money while respecting hard filters.

Tasks:
1) Rank top 5 listings by value-for-money.
2) Explain why each top listing is good (rent/m², total monthly cost, move-in total, commute).
3) List all rejected listings with exact flags and what would need to change.
4) Suggest 2 fallback areas with good commute if preferred areas are too expensive.
5) Output a short decision summary.
```
