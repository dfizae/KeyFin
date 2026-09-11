"""Capture daily means from the same pinned-engine simulation as its P50 result."""

from typing import TYPE_CHECKING

import numpy as np
from fdt import Engine, Twin
from fdt.simulation import RandomBundle, Simulation
from pydantic import JsonValue
from typing_extensions import override

from coaching_service.chart_contract import DailyForecast, DailyPoint
from coaching_service.errors import ServiceError

if TYPE_CHECKING:
    from numpy.typing import NDArray


def daily_forecast(sim: Simulation, paths: int) -> DailyForecast:
    """Preserve every future date, including zero-spend days and envelope order."""
    days = len(sim.dates)
    if (
        paths < 1
        or days < 1
        or sim.by_envelope.shape != (paths, days, 7)
        or sim.consumption.shape != (paths, days)
        or sim.pending.shape != (paths, days)
    ):
        raise ServiceError("chart_daily_shape_mismatch", 502)
    if any(
        not np.isfinite(values).all() or (values < 0).any()
        for values in (sim.by_envelope, sim.consumption, sim.pending)
    ):
        raise ServiceError("chart_daily_invalid_amount", 502)
    # Pending consumption is present in the total but has no classified envelope.
    difference: NDArray[np.int64] = sim.by_envelope.sum(axis=2) + sim.pending - sim.consumption
    if difference.any():
        raise ServiceError("chart_daily_consumption_mismatch", 502)
    means: NDArray[np.float64] = sim.by_envelope.mean(axis=0)
    return DailyForecast(
        points=tuple(
            DailyPoint(date=day, amounts_krw=tuple(round(means.item(i, j)) for j in range(7)))
            for i, day in enumerate(sim.dates)
        )
    )


class ChartEngine(Engine):
    """A sidecar at the pinned _base seam; upstream result and validation stay intact."""

    def __init__(self, twin: Twin) -> None:
        super().__init__(twin)
        self.daily: DailyForecast | None = None

    @override
    def _base(self, req: dict[str, JsonValue], bundle: RandomBundle, sim: Simulation) -> dict[str, JsonValue]:
        result = super()._base(req, bundle, sim)
        self.daily = daily_forecast(sim, bundle.paths)
        return result
