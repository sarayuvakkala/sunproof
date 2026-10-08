"""Fixed numbers SunProof uses, with their sources. Shown on screen as assumptions."""

# CEA CO2 Baseline Database for the Indian Power Sector, Version 22.0 (Aug 2026), FY 2025-26.
# Combined margin, the standard factor for generation displaced by renewables.
CO2_KG_PER_KWH = 0.705
CO2_SOURCE = "CEA CO2 Baseline Database v22.0, FY 2025-26, combined margin"

# Delhi domestic, marginal slab incl. PPAC, rounded. Household can override.
DEFAULT_TARIFF_INR_PER_KWH = 8.0
TARIFF_SOURCE = "Delhi domestic tariff (DERC slabs + PPAC), household-editable"

# Delhi soiling study: average loss per month without cleaning.
DEFAULT_DUST_LOSS_PCT_PER_MONTH = 7.6
