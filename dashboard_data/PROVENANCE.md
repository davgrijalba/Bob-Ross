# Dashboard data: provenance

All four CSVs are written by **`scripts/prepare_data.py`** from `data/raw/elements-by-episode.csv` (FiveThirtyEight, CC BY 4.0; never modified). The script writes the same files to `dashboard_data/` and to `dashboard/public/dashboard_data/`, the copy the website loads.

## Regenerate

From the project folder, with a Python environment that has pandas (for example the course's `Session 1/.venv`):

```
python scripts/prepare_data.py
```

The script ends with `assert` checks and stops with an error if any fails.

## Analysis decisions

| Decision | Why |
|---|---|
| **Guest episodes excluded** (22 episodes with `GUEST = 1`) | The question is about Bob Ross's own style |
| **Episodes with nothing recorded excluded** (3: S09E10, S15E04, S26E10) | Every column is 0, including in "Purple Mountain Range", so they look uncoded |
| **378 paintings analysed** | 403 − 22 − 3 |
| `GUEST`, `STEVE_ROSS`, `DIANE_ANDRE` are not elements | They say who painted, not what is in the scene |
| Frame columns kept in a separate "Frames" category | They describe the frame, not the scene; "scene elements" never include frames |
| Elements never present in the analysed paintings dropped (`LAKES`, `PORTRAIT`) | Nothing to show |
| Element categories (Trees & plants, Water, Sky & light…) | Grouping chosen for this dashboard; not defined by the source |
| **Early = seasons 1–15 (181 paintings), late = seasons 16–31 (197 paintings)** | Single seasons have only 9–13 paintings, so one painting moves a season's percentage by about 8 points |
| **"Clear" change = two-proportion z-test, \|z\| ≥ 1.96** | A change is called clear only if it is at least about twice its expected random variation |

## Files

### `element_share_by_season.csv`
- **One row** = one element in one season (62 elements × 31 seasons = 1,922 rows).
- **Columns:** `season, element, element_label, category, paintings_in_season, paintings_with_element, pct_of_paintings`
- **Calculation:** paintings in that season containing the element ÷ paintings analysed in that season × 100.

### `element_change_summary.csv`
- **One row** = one element (62 rows), sorted from largest rise to largest fall.
- **Columns:** `element, element_label, category, pct_all_seasons, pct_seasons_1_15, pct_seasons_16_31, change_pct_points, standard_error_pct_points, z_score, direction, peak_season, peak_season_pct`
- **Calculation:** percentage of paintings with the element in seasons 1–15 and in 16–31; change = late − early; standard error = √(p₁(1−p₁)/n₁ + p₂(1−p₂)/n₂); z = change ÷ standard error; `direction` is `rose`, `fell`, or `no clear change`.

### `season_summary.csv`
- **One row** = one season (31 rows).
- **Columns:** `season, episodes, paintings_analysed, guest_episodes, nothing_recorded_episodes, avg_scene_elements, pct_framed`

### `episodes.csv`
- **One row** = one episode (all 403, including excluded ones).
- **Columns:** `episode_code, season, episode_number, title, painted_by, included_in_analysis, nothing_recorded, scene_elements, framed, elements`
- `title` has the source's quote marks removed and is in title case. `elements` lists the scene elements present.

## Checks run by the script
- 403 episodes, 31 seasons, 13 episodes each.
- Analysed = 403 − guest − uncoded, with no episode in both groups; season totals add up to 378.
- Every share is between 0 and 100; every element has a row for every season.
- Spot check: season 10 `MOUNTAIN` share recomputed directly from the raw file matches the table.
- `change_pct_points` equals late − early within rounding.

## Caveats
- **Presence, not prominence:** an element counts the same whether it fills the canvas or is a small detail.
- **Coding is FiveThirtyEight's.** Related tags overlap (`CLOUDS`, `CUMULUS`, `CIRRUS`; `TREE`, `TREES`, `CONIFER`, `DECIDUOUS`); some tags (for example `STRUCTURE`) are not defined in the source.
- **Many comparisons:** 62 elements are tested, so about 3 could pass the 5% threshold by chance alone. Treat changes with \|z\| close to 2 (for example Flowers, with very few paintings) as weak evidence; the largest ones (Clouds z = −5.6, Cumulus −3.7, Cirrus −3.7, Bushes −3.0) are much more robust.
- **Season-level percentages are noisy** (9–13 paintings per season).
