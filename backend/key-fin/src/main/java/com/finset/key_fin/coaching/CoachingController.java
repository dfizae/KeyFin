package com.finset.key_fin.coaching;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.finset.key_fin.global.base.BaseResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

/** Same response envelope as the existing app API; the inner AI contract stays lossless. */
@RestController
@RequestMapping("/api/v1/coaching")
public class CoachingController {
    private final CoachingClient client;

    public CoachingController(CoachingClient client) { this.client = client; }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record StartSession(@Pattern(regexp = "[A-Za-z0-9_.-]{1,120}") String coaching_id) { }
    public record Question(@NotBlank @Size(max = 2000) String question) { }

    @PostMapping("/sessions")
    public BaseResponse<JsonNode> start(@AuthenticationPrincipal Long userId,
            @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody StartSession body) {
        return BaseResponse.ok(client.post(userId, "/v1/sessions", key, body));
    }

    @GetMapping("/sessions/{id}")
    public BaseResponse<JsonNode> session(@AuthenticationPrincipal Long userId,
            @PathVariable @Pattern(regexp = "[A-Za-z0-9_.-]{1,120}") String id) {
        return BaseResponse.ok(client.get(userId, "/v1/sessions/" + id));
    }

    @PostMapping("/sessions/{id}/messages")
    public BaseResponse<JsonNode> message(@AuthenticationPrincipal Long userId,
            @PathVariable @Pattern(regexp = "[A-Za-z0-9_.-]{1,120}") String id,
            @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody Question body) {
        return BaseResponse.ok(client.post(userId, "/v1/sessions/" + id + "/messages", key, body));
    }

    @PostMapping("/questions")
    public BaseResponse<JsonNode> question(@AuthenticationPrincipal Long userId,
            @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody Question body) {
        return BaseResponse.ok(client.post(userId, "/v1/finance/questions", key, body));
    }

    @GetMapping("/answers/{id}")
    public BaseResponse<JsonNode> answer(@AuthenticationPrincipal Long userId,
            @PathVariable @Pattern(regexp = "[A-Za-z0-9_.-]{1,120}") String id) {
        return BaseResponse.ok(client.get(userId, "/v1/answers/" + id));
    }

    @PostMapping("/personal/questions")
    public BaseResponse<JsonNode> personalQuestion(@AuthenticationPrincipal Long userId,
            @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody Question body) {
        return BaseResponse.ok(client.post(userId, "/v1/personal/questions", key, body));
    }

    @GetMapping("/records/{id}")
    public BaseResponse<JsonNode> coaching(@AuthenticationPrincipal Long userId,
            @PathVariable @Pattern(regexp = "[A-Za-z0-9_.-]{1,120}") String id) {
        return BaseResponse.ok(client.get(userId, "/v1/coaching/" + id));
    }

    @GetMapping("/notifications")
    public BaseResponse<JsonNode> notifications(@AuthenticationPrincipal Long userId) {
        return BaseResponse.ok(client.notifications(userId));
    }

    @PostMapping("/notifications/{id}/ack")
    public BaseResponse<JsonNode> acknowledge(@AuthenticationPrincipal Long userId,
            @PathVariable @Pattern(regexp = "[A-Za-z0-9_.-]{1,120}") String id,
            @RequestHeader("Idempotency-Key") String key) {
        return BaseResponse.ok(client.acknowledgeNotification(userId, id, key));
    }
}
