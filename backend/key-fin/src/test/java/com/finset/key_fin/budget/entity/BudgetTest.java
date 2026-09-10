package com.finset.key_fin.budget.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BudgetTest {

	@Test
	void appliesDatabaseDefaults() {
		Budget budget = new Budget();

		assertThat(budget.getStatus()).isEqualTo(BudgetStatus.PROPOSED);
		assertThat(budget.getEmergencyAmount()).isZero();
	}
}
