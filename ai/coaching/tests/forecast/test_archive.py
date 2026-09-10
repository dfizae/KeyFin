"""An old worker run cannot silently score a different set of inputs."""

import hashlib
import json
from pathlib import Path

import pytest

from benchmarks.forecast.evaluate import load_archive


@pytest.mark.parametrize("finished", [False, True])
def test_incomplete_or_mismatched_worker_archive_is_rejected(tmp_path: Path, *, finished: bool) -> None:
    inputs = tmp_path / "inputs.json"
    _ = inputs.write_bytes(b"new-observed-inputs")
    bundle = tmp_path / "bundle.json"
    _ = bundle.write_text(json.dumps({
        "files": {"runtime.json": {"input_sha256": hashlib.sha256(b"old-inputs").hexdigest()}},
        "sha256": {}, "upload_manifest": {}, "finished": finished,
    }), encoding="utf-8")
    with pytest.raises(ValueError, match=r"inputs|incomplete"):
        load_archive(bundle, inputs)
