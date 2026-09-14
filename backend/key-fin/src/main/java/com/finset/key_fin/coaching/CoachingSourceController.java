package com.finset.key_fin.coaching;

import com.finset.key_fin.global.base.BaseResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/** Browser may request a source refresh but cannot provide amounts, owner IDs or engine documents. */
@RestController
@RequestMapping("/api/v1/coaching/source")
public class CoachingSourceController {
    private final CoachingSourceAdapter adapter;
    public CoachingSourceController(CoachingSourceAdapter adapter) {
        this.adapter = adapter;
    }

    public record BootstrapRequest(@NotNull LocalDate asOf) { }

    @GetMapping("/readiness")
    public BaseResponse<CoachingSourceAdapter.Readiness> readiness(@AuthenticationPrincipal Long userId,
            @RequestParam LocalDate asOf) {
        return BaseResponse.ok(adapter.readiness(userId, asOf));
    }
    @PostMapping("/bootstrap")
    public BaseResponse<CoachingSourceAdapter.Result> bootstrap(@AuthenticationPrincipal Long userId,
            @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody BootstrapRequest body) {
        return BaseResponse.ok(adapter.bootstrap(userId, body.asOf(), key));
    }
    @PostMapping("/synchronize")
    public BaseResponse<CoachingSourceAdapter.SyncResult> synchronize(@AuthenticationPrincipal Long userId,
            @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody BootstrapRequest body) {
        return BaseResponse.ok(adapter.synchronize(userId, body.asOf(), key));
    }
}
