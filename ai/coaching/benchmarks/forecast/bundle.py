# /// script
# requires-python = ">=3.11"
# dependencies = ["pydantic"]
# ///
# How to run: python -m benchmarks.forecast.bundle /private/results /private/result-bundle.json
"""Export completed forecast results without configuration, checkpoints or process logs."""

import hashlib
import json
import sys
from pathlib import Path

from pydantic import JsonValue, TypeAdapter


def export(directory: Path, output: Path) -> None:
    if output.exists():
        raise FileExistsError("Use a new result bundle path")
    if (directory / "completed.json").read_text(encoding="utf-8") != '{"completed":true}':
        raise ValueError("The worker has not completed")
    paths = [*directory.glob("*.predictions.json"), *directory.glob("*.training.json"),
             *directory.glob("*.inference.json"), directory / "runtime.json"]
    bundle = {
        "files": {p.name: TypeAdapter(JsonValue).validate_json(p.read_bytes()) for p in sorted(paths)},
        "sha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)},
        "upload_manifest": {}, "finished": True,
    }
    _ = output.write_text(json.dumps(bundle, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    export(Path(sys.argv[1]), Path(sys.argv[2]))
