package com.finset.key_fin.coaching.client;

import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.finset.key_fin.coaching.dto.CoachingSessionView;
import com.finset.key_fin.coaching.dto.CoachingTurnReply;

@Component
@ConditionalOnProperty(prefix = "coaching.api", name = "token")
public class CoachingChatClient {

	private static final String SESSIONS_PATH = "/v1/sessions";
	private static final String SESSION_PATH = "/v1/sessions/{sessionId}";
	private static final String MESSAGES_PATH = "/v1/sessions/{sessionId}/messages";
	private static final String IDEMPOTENCY_KEY = "Idempotency-Key";

	private final RestClient coachingRestClient;

	public CoachingChatClient(@Qualifier("coachingRestClient") RestClient coachingRestClient) {
		this.coachingRestClient = coachingRestClient;
	}

	public CoachingSessionView createSession() {
		return coachingRestClient.post()
				.uri(SESSIONS_PATH)
				.contentType(MediaType.APPLICATION_JSON)
				.header(IDEMPOTENCY_KEY, UUID.randomUUID().toString())
				.body(Map.of())
				.retrieve()
				.body(CoachingSessionView.class);
	}

	public CoachingSessionView getSession(String sessionId) {
		return coachingRestClient.get()
				.uri(SESSION_PATH, sessionId)
				.retrieve()
				.body(CoachingSessionView.class);
	}

	public CoachingTurnReply sendMessage(String sessionId, String question) {
		return coachingRestClient.post()
				.uri(MESSAGES_PATH, sessionId)
				.contentType(MediaType.APPLICATION_JSON)
				.header(IDEMPOTENCY_KEY, UUID.randomUUID().toString())
				.body(Map.of("question", question))
				.retrieve()
				.body(CoachingTurnReply.class);
	}
}
