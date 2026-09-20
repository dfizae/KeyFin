package com.finset.key_fin.coaching.dto;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/** `POST /v1/sessions/{id}/messages` 응답. `answer_type` 이 있으면 ChatAnswer, `receipt` 가 있으면 Coaching. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CoachingTurnReply(
		@JsonProperty("id") String id,
		@JsonProperty("answer_type") String answerType,
		@JsonProperty("status") String status,
		@JsonProperty("text") String text,
		@JsonProperty("wording_source") String wordingSource,
		@JsonProperty("fallback_reason") String fallbackReason,
		@JsonProperty("receipt") Map<String, Object> receipt
) {
	public boolean isCoaching() {
		return answerType == null && receipt != null;
	}
}
