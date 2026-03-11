from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

INPUT_FILE = Path("raw_listings.json")
OUTPUT_FILE = Path("rentals_for_chatgpt.json")

MAX_RENT_DKK = 13_000
MIN_SIZE_M2 = 40.0
MAX_COMMUTE_MIN = 30
HIGH_MOVE_IN_MULTIPLIER = 4.0

PREFERRED_AREAS = {
    "høje-taastrup",
    "hoje-taastrup",
    "glostrup",
    "brønshøj",
    "bronshoj",
    "nordvest",
}


@dataclass(slots=True)
class NormalizedListing:
    listing_id: str
    title: str
    area: str
    address: str
    size_m2: float
    rooms: float
    monthly_rent_dkk: float
    monthly_aconto_dkk: float
    monthly_other_fees_dkk: float
    deposit_dkk: float
    prepaid_rent_months: float
    move_in_fee_dkk: float
    allows_cpr: bool | None
    commute_to_kbh_h_min: int
    notes: str


@dataclass(slots=True)
class EvaluatedListing:
    normalized: NormalizedListing
    total_monthly_cost_dkk: float
    move_in_total_dkk: float
    rent_per_m2: float | None
    hard_filter_pass: bool
    flags: dict[str, bool]


def _to_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value: Any, default: int) -> int:
    if value is None:
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _to_bool_or_none(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "yes", "y", "1"}:
            return True
        if lowered in {"false", "no", "n", "0"}:
            return False
    return None


def _normalize_listing(index: int, raw: dict[str, Any]) -> NormalizedListing:
    listing_id = str(raw.get("id") or f"listing-{index + 1}")
    return NormalizedListing(
        listing_id=listing_id,
        title=str(raw.get("title") or "Untitled listing"),
        area=str(raw.get("area") or "Unknown").strip(),
        address=str(raw.get("address") or "").strip(),
        size_m2=max(_to_float(raw.get("size_m2"), 0.0), 0.0),
        rooms=max(_to_float(raw.get("rooms"), 0.0), 0.0),
        monthly_rent_dkk=max(_to_float(raw.get("monthly_rent_dkk"), 0.0), 0.0),
        monthly_aconto_dkk=max(_to_float(raw.get("monthly_aconto_dkk"), 0.0), 0.0),
        monthly_other_fees_dkk=max(_to_float(raw.get("monthly_other_fees_dkk"), 0.0), 0.0),
        deposit_dkk=max(_to_float(raw.get("deposit_dkk"), 0.0), 0.0),
        prepaid_rent_months=max(_to_float(raw.get("prepaid_rent_months"), 0.0), 0.0),
        move_in_fee_dkk=max(_to_float(raw.get("move_in_fee_dkk"), 0.0), 0.0),
        allows_cpr=_to_bool_or_none(raw.get("allows_cpr")),
        commute_to_kbh_h_min=max(_to_int(raw.get("commute_to_kbh_h_min"), 999), 0),
        notes=str(raw.get("notes") or "").strip(),
    )


def _is_preferred_or_commute_friendly(area: str, commute_to_kbh_h_min: int) -> bool:
    normalized_area = area.lower().strip()
    return normalized_area in PREFERRED_AREAS or commute_to_kbh_h_min <= MAX_COMMUTE_MIN


def _evaluate(normalized: NormalizedListing) -> EvaluatedListing:
    total_monthly_cost = (
        normalized.monthly_rent_dkk
        + normalized.monthly_aconto_dkk
        + normalized.monthly_other_fees_dkk
    )
    prepaid_rent_cost = normalized.prepaid_rent_months * total_monthly_cost
    move_in_total = normalized.deposit_dkk + prepaid_rent_cost + normalized.move_in_fee_dkk

    rent_per_m2 = None
    if normalized.size_m2 > 0:
        rent_per_m2 = round(total_monthly_cost / normalized.size_m2, 2)

    too_expensive = total_monthly_cost > MAX_RENT_DKK
    too_small = normalized.size_m2 < MIN_SIZE_M2
    bad_for_two_people = normalized.rooms < 2 and normalized.size_m2 < 50
    long_commute = normalized.commute_to_kbh_h_min > MAX_COMMUTE_MIN
    missing_cpr = normalized.allows_cpr is not True
    high_move_in_cost = move_in_total > (total_monthly_cost * HIGH_MOVE_IN_MULTIPLIER)
    unsuitable_area = not _is_preferred_or_commute_friendly(
        normalized.area,
        normalized.commute_to_kbh_h_min,
    )

    hard_filter_pass = not any(
        [too_expensive, too_small, bad_for_two_people, long_commute, unsuitable_area]
    )

    flags = {
        "too_expensive": too_expensive,
        "too_small": too_small,
        "bad_for_two_people": bad_for_two_people,
        "long_commute": long_commute,
        "missing_cpr": missing_cpr,
        "high_move_in_cost": high_move_in_cost,
    }

    return EvaluatedListing(
        normalized=normalized,
        total_monthly_cost_dkk=round(total_monthly_cost, 2),
        move_in_total_dkk=round(move_in_total, 2),
        rent_per_m2=rent_per_m2,
        hard_filter_pass=hard_filter_pass,
        flags=flags,
    )


def _load_raw_listings(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("raw_listings.json must contain a JSON array of listing objects.")
    dict_items: list[dict[str, Any]] = []
    for item in data:
        if isinstance(item, dict):
            dict_items.append(item)
    return dict_items


def main() -> None:
    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Missing {INPUT_FILE}. Create it first (see README.md in rentals_tool)."
        )

    raw_listings = _load_raw_listings(INPUT_FILE)
    evaluated = []
    for i, raw in enumerate(raw_listings):
        normalized = _normalize_listing(i, raw)
        result = _evaluate(normalized)
        evaluated.append(
            {
                "normalized": asdict(result.normalized),
                "metrics": {
                    "total_monthly_cost_dkk": result.total_monthly_cost_dkk,
                    "move_in_total_dkk": result.move_in_total_dkk,
                    "rent_per_m2": result.rent_per_m2,
                    "hard_filter_pass": result.hard_filter_pass,
                },
                "flags": result.flags,
            }
        )

    OUTPUT_FILE.write_text(
        json.dumps(
            {
                "criteria": {
                    "household_size": 2,
                    "max_rent_dkk": MAX_RENT_DKK,
                    "min_size_m2": MIN_SIZE_M2,
                    "preferred_areas": sorted(PREFERRED_AREAS),
                    "max_commute_to_kbh_h_min": MAX_COMMUTE_MIN,
                },
                "listings": evaluated,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {len(evaluated)} listings to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
