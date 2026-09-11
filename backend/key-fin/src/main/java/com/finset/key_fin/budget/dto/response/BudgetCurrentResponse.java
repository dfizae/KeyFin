package com.finset.key_fin.budget.dto.response;

import java.time.LocalDate;
import java.util.List;

public record BudgetCurrentResponse(
		Long budgetId,
		String month,
		LocalDate periodFrom,
		LocalDate periodTo,
		String status,
		Total total,
		List<EnvelopeBoard> envelopes
) {

	public record Total(long confirmed, long spent, long remaining, Integer remainingRate) {
	}

	public record EnvelopeBoard(
			int envelopeId,
			String name,
			Long proposedAmount,
			Long confirmedAmount,
			Long spent,
			Long remaining,
			Integer remainingRate
	) {

		public static EnvelopeBoard proposed(int envelopeId, String name, long proposedAmount) {
			return new EnvelopeBoard(envelopeId, name, proposedAmount, null, null, null, null);
		}

		public static EnvelopeBoard confirmed(int envelopeId, String name, long confirmedAmount, long spent,
				long remaining, Integer remainingRate) {
			return new EnvelopeBoard(envelopeId, name, null, confirmedAmount, spent, remaining, remainingRate);
		}
	}
}
