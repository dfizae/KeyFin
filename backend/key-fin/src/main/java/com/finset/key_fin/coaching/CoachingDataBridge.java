package com.finset.key_fin.coaching;

import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/**
 * Internal write-role bridge. There is intentionally no browser endpoint for replacing financial facts.
 * A domain integration must pass its authenticated owner and an approved, source-stamped snapshot.
 */
@Service
public class CoachingDataBridge {
    private final CoachingClient client;
    public CoachingDataBridge(CoachingClient client) { this.client = client; }

    public JsonNode replacePersonalContext(Long authenticatedUserId, String requestKey, PersonalContextInput input) {
        return client.postBackend(authenticatedUserId, "/v1/personal/context", requestKey, input);
    }

    public JsonNode bootstrap(Long authenticatedUserId, String requestKey, EngineInput.Bootstrap input) {
        return client.postBackend(authenticatedUserId, "/v1/twin", requestKey, input);
    }

    public JsonNode applyEvent(Long authenticatedUserId, String requestKey, EngineInput.Event input) {
        return client.postBackend(authenticatedUserId, "/v1/events", requestKey, input);
    }
}
