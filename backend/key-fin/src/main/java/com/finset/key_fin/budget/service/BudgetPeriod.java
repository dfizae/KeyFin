package com.finset.key_fin.budget.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

public record BudgetPeriod(String month, LocalDate from, LocalDate to) {

	public static BudgetPeriod of(String month, int anchorDay) {
		LocalDate from = LocalDate.parse(month + "01", DateTimeFormatter.BASIC_ISO_DATE)
				.withDayOfMonth(anchorDay);
		return new BudgetPeriod(month, from, from.plusMonths(1));
	}
}
