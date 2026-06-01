# Pricing Model

Plans contain price components. Supported component types are flat, per-seat, usage, tiered, volume, and graduated.

Graduated tiers charge each bracket cumulatively. For 150 units with tiers 100 at 10 cents and next 100 at 8 cents, the total is 1000 + 400 = 1400 cents.

Volume tiers choose one applicable tier for the full quantity. For the same 150 units, the 8-cent tier applies to all units, producing 1200 cents.

Usage components can define an included quantity. LedgerFlow bills only quantity above that included amount.
