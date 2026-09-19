package com.finset.key_fin.budget.entity;

/** 봉투 잔여율 알림 단계. 아래로 갈수록 심각하다. */
public enum BudgetAlertLevel {

	NONE,
	REMAINING_50,
	REMAINING_20,
	REMAINING_5,
	EXCEEDED;

	/** 확정액이 없거나 0인 봉투는 잔여율이 정의되지 않아 판정하지 않는다. */
	public static BudgetAlertLevel of(Long confirmedAmount, long remaining) {
		if (confirmedAmount == null || confirmedAmount <= 0) {
			return null;
		}
		if (remaining < 0) {
			return EXCEEDED;
		}
		long remainingRate = remaining * 100 / confirmedAmount;
		if (remainingRate <= 5) {
			return REMAINING_5;
		}
		if (remainingRate <= 20) {
			return REMAINING_20;
		}
		return remainingRate <= 50 ? REMAINING_50 : NONE;
	}

	public boolean isWorseThan(BudgetAlertLevel other) {
		return ordinal() > other.ordinal();
	}

	public boolean requiresAction() {
		return this == EXCEEDED;
	}
}
