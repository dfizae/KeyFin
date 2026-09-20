package com.finset.key_fin.coaching.dto;

public record ChatReply(
		String reply,
		Kind kind,
		String status,
		String source,
		String fallbackReason,
		String answerId
) {
	public enum Kind { CHAT, COACHING }

	public static ChatReply from(CoachingTurnReply turn) {
		boolean coaching = turn.isCoaching();
		return new ChatReply(
				turn.text(),
				coaching ? Kind.COACHING : Kind.CHAT,
				coaching ? "answered" : turn.status(),
				turn.wordingSource(),
				turn.fallbackReason(),
				turn.id());
	}
}
