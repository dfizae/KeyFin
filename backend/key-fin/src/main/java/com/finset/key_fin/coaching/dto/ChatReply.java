package com.finset.key_fin.coaching.dto;

import java.util.List;

public record ChatReply(
		String reply,
		Kind kind,
		String status,
		String source,
		String fallbackReason,
		String answerId,
		String chartId,
		List<Row> rows,
		Long totalKrw
) {
	public record Row(String envelope, long totalKrw, int count) {
	}
	public enum Kind { CHAT, COACHING }

	public static ChatReply from(CoachingTurnReply turn, String chartId) {
		boolean coaching = turn.isCoaching();
		List<Row> rows = turn.rows() == null ? List.of() : turn.rows().stream()
				.map(row -> new Row(row.envelope(), row.totalKrw(), row.count()))
				.toList();
		return new ChatReply(
				turn.text(),
				coaching ? Kind.COACHING : Kind.CHAT,
				coaching ? "answered" : turn.status(),
				turn.wordingSource(),
				turn.fallbackReason(),
				turn.id(),
				chartId,
				rows,
				turn.totalKrw());
	}
}
