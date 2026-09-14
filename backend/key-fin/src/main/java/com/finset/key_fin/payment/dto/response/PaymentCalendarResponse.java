package com.finset.key_fin.payment.dto.response;

import java.time.LocalDate;
import java.util.List;

import com.finset.key_fin.payment.entity.ExpenseType;
import com.finset.key_fin.payment.entity.FixedExpense;

public record PaymentCalendarResponse(String month, List<Day> days) {

	public record Day(LocalDate date, List<Item> items) {
	}

	public record Item(
			CalendarItemType type,
			Long fixedExpenseId,
			String name,
			ExpenseType expenseType,
			long amount,
			boolean estimated,
			Long withdrawalAccountId,
			Boolean prepared,
			Long shortage
	) {

		public static Item of(FixedExpense expense) {
			return new Item(
					expense.isSynced() ? CalendarItemType.CARD_SUBSCRIPTION : CalendarItemType.FIXED,
					expense.getId(),
					expense.getName(),
					expense.getExpenseType(),
					expense.getAmount(),
					expense.isVariable(),
					expense.getWithdrawalAccountId(),
					null,
					null);
		}
	}

	public enum CalendarItemType {
		FIXED,
		CARD_SUBSCRIPTION,
		CARD_BILL
	}
}
