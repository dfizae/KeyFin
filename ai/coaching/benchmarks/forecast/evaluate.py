# /// script
# requires-python = ">=3.11"
# dependencies = ["pydantic", "numpy"]
# ///
# How to run: python -m benchmarks.forecast.evaluate /private/prepared /private/bundle.json /private/analysis
# ruff: noqa: T201
"""Replay saved accelerator predictions without calling a model or changing forecasts."""

import hashlib
import json
import sys
from pathlib import Path
from typing import Final

from pydantic import JsonValue, TypeAdapter

from .contracts import Calibration, Family, Forecast, Frozen, InputBundle, MetricSet, Truth
from .data import FAMILIES
from .scoring import expanded, summarize
from .selection import calibrate, choose

HERE: Final = Path(__file__).resolve().parent


class RemoteArchive(Frozen):
    files: dict[str, JsonValue]
    sha256: dict[str, str]
    upload_manifest: dict[str, str]
    finished: bool


class ModelReport(Frozen):
    raw: MetricSet
    calibrated: MetricSet
    families: dict[Family, MetricSet]
    users: dict[str, MetricSet]


class Lock(Frozen):
    selections: dict[str, str]
    calibration: tuple[Calibration, ...]
    model_input_sha256: str
    remote_bundle_sha256: str
    source_sha256: dict[str, str]


def load_archive(remote_path: Path, input_path: Path) -> RemoteArchive:
    remote = RemoteArchive.model_validate_json(remote_path.read_bytes())
    if not remote.finished:
        raise ValueError("Remote execution is incomplete")
    runtime = remote.files.get("runtime.json")
    if not isinstance(runtime, dict) or runtime.get("input_sha256") != hashlib.sha256(
        input_path.read_bytes(),
    ).hexdigest():
        raise ValueError("Worker inputs differ from the evaluation inputs")
    return remote


def main() -> None:
    prepared, remote_path, destination = (Path(value).resolve() for value in sys.argv[1:4])
    remote = load_archive(remote_path, prepared / "model_inputs.json")
    destination.mkdir(exist_ok=False)
    bundle = InputBundle.model_validate_json((prepared / "model_inputs.json").read_bytes())
    truths = TypeAdapter(list[Truth]).validate_json((prepared / "truth.json").read_bytes())
    truth = {row.case_id: row.actual for row in truths}
    forecasts = TypeAdapter(list[Forecast]).validate_json((prepared / "baselines.json").read_bytes())
    for name, value in remote.files.items():
        if name.endswith(".predictions.json"):
            forecasts.extend(TypeAdapter(list[Forecast]).validate_python(value))
    index = {(row.model, row.fold, row.case_id): row for row in forecasts}
    if len(index) != len(forecasts):
        raise ValueError("Duplicate prediction key")
    cases = {case.case_id: case for case in bundle.cases}
    if len(cases) != len(bundle.cases) or set(cases) != set(truth):
        raise ValueError("Case and truth keys disagree")
    models = sorted({row.model for row in forecasts})
    users = sorted({case.user for case in bundle.cases})
    selections: dict[str, str] = {}
    calibrations: list[Calibration] = []
    raw: dict[str, list[Forecast]] = {name: [] for name in models}
    corrected: dict[str, list[Forecast]] = {name: [] for name in models}
    selected: list[Forecast] = []
    selected_raw: list[Forecast] = []
    for user in users:
        development = [case for case in bundle.cases if case.split == "development" and case.user != user]
        evaluation = [case for case in bundle.cases if case.split == "evaluation" and case.user == user]
        dev_predictions = {
            name: [index[(name, user if name.startswith("chronos_ft") else "common", case.case_id)]
                   for case in development] for name in models
        }
        selections[user] = choose(dev_predictions, truth)
        for name in models:
            corrections = {family: calibrate(
                user, family, [row for row in dev_predictions[name] if cases[row.case_id].family == family],
                cases, truth,
            ) for family in FAMILIES}
            calibrations.extend(corrections.values())
            for case in evaluation:
                row = index[(name, user if name.startswith("chronos_ft") else "common", case.case_id)]
                fixed = expanded(row, case, corrections[case.family].radius)
                raw[name].append(row)
                corrected[name].append(fixed)
                if name == selections[user]:
                    selected.append(fixed)
                    selected_raw.append(row)
    lock = Lock(selections=selections, calibration=tuple(calibrations),
                model_input_sha256=hashlib.sha256((prepared / "model_inputs.json").read_bytes()).hexdigest(),
                remote_bundle_sha256=hashlib.sha256(remote_path.read_bytes()).hexdigest(),
                source_sha256={p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                               for p in sorted(HERE.glob("*.py"))})
    _ = (destination / "selection_lock.json").write_text(lock.model_dump_json(indent=2), encoding="utf-8")
    reports = {name: ModelReport(
        raw=summarize(raw[name], truth), calibrated=summarize(corrected[name], truth),
        families={family: summarize(
            [row for row in corrected[name] if cases[row.case_id].family == family], truth,
        )
                  for family in FAMILIES},
        users={user: summarize([row for row in corrected[name] if cases[row.case_id].user == user], truth)
               for user in users},
    ) for name in models}
    reports["development_selected"] = ModelReport(
        raw=summarize(selected_raw, truth), calibrated=summarize(selected, truth),
        families={family: summarize([row for row in selected if cases[row.case_id].family == family], truth)
                  for family in FAMILIES},
        users={user: summarize([row for row in selected if cases[row.case_id].user == user], truth)
               for user in users},
    )
    _ = (destination / "scores.json").write_bytes(
        TypeAdapter(dict[str, ModelReport]).dump_json(reports, indent=2),
    )
    _ = (destination / "selected_predictions.json").write_bytes(
        TypeAdapter(list[Forecast]).dump_json(selected),
    )
    print(json.dumps({name: {"wape": result.calibrated.wape, "coverage": result.calibrated.coverage80,
                            "normalized_wis": result.calibrated.normalized_wis}
                      for name, result in reports.items()}))
    print("R7_SCORED")


if __name__ == "__main__":
    main()
