package com.finset.key_fin.budget.service;

import com.finset.key_fin.budget.repository.BudgetRepository;
import com.finset.key_fin.user.entity.UserSettings;
import com.finset.key_fin.user.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class BudgetOverrunService {
	private final BudgetRepository budgets;
	private final UserSettingsRepository settings;
	private final EnvelopeBalanceService balances;

	/** Uses the existing budget board aggregation, without creating a proposal. */
	public Optional<Long> currentExceededBudgetId(long userId, LocalDate today) {
		int anchor = settings.findById(userId).map(UserSettings::getBudgetAnchorDay).orElse(1);
		String month = BudgetPeriod.current(today, anchor).month();
		return budgets.findByUserIdAndBudgetMonth(userId, month).filter(b -> b.isConfirmed()).flatMap(budget -> {
			long confirmed = 0;
			long spent = 0;
			for (var balance : balances.getMonthlyBalances(userId, month)) {
				confirmed += balance.confirmedAmount();
				spent += balance.spent();
			}
			return spent > confirmed ? Optional.of(budget.getId()) : Optional.empty();
		});
	}
}
