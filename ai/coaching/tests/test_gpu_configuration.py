import pytest

from scripts.gpu_registry import validate_device


@pytest.mark.parametrize("environment", [
    {}, {"CUDA_VISIBLE_DEVICES": "GPU-a"},
    {"CUDA_VISIBLE_DEVICES": "GPU-a,GPU-b", "COACH_GPU_ALLOWED_DEVICES": "GPU-a,GPU-b"},
    {"CUDA_VISIBLE_DEVICES": "GPU-c", "COACH_GPU_ALLOWED_DEVICES": "GPU-a"},
])
def test_unassigned_or_multiple_devices_are_rejected(environment: dict[str, str]) -> None:
    with pytest.raises(RuntimeError, match="explicit_single_authorized_accelerator_required"):
        validate_device(environment)


def test_only_explicitly_selected_authorized_device_is_accepted() -> None:
    validate_device({"CUDA_VISIBLE_DEVICES": "GPU-a", "COACH_GPU_ALLOWED_DEVICES": "GPU-a,GPU-b"})
