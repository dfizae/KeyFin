package com.finset.key_fin.payment.service;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finset.key_fin.payment.client.FinanceSubscriptionClient;
import com.finset.key_fin.payment.dto.response.FinanceSubscription;
import com.finset.key_fin.payment.entity.FixedExpense;
import com.finset.key_fin.payment.repository.FixedExpenseRepository;
import com.finset.key_fin.user.entity.User;
import com.finset.key_fin.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SubscriptionSyncService {

	private final FinanceSubscriptionClient financeSubscriptionClient;
	private final FixedExpenseRepository fixedExpenseRepository;
	private final UserRepository userRepository;

	@Transactional
	public SyncResult sync(long userId) {
		User user = userRepository.getReferenceById(userId);
		String userKey = user.getFinUserKey();
		if (userKey == null) {
			return SyncResult.NOT_CONNECTED;
		}

		List<FinanceSubscription> remote = financeSubscriptionClient.findSubscriptions(userKey);
		Map<String, FixedExpense> existing = fixedExpenseRepository
				.findAllByUserIdAndFinSubscriptionIdIsNotNull(userId).stream()
				.collect(Collectors.toMap(FixedExpense::getFinSubscriptionId, Function.identity()));

		int created = 0, updated = 0, deactivated = 0, skipped = 0;
		Set<String> seen = new HashSet<>();
		for (FinanceSubscription subscription : remote) {
			if (!subscription.isMonthly()) {
				skipped++;
				continue;
			}
			seen.add(subscription.subscriptionId());
			FixedExpense row = existing.get(subscription.subscriptionId());
			int paymentDay = subscription.nextPayment().getDayOfMonth();
			if (subscription.isActive()) {
				if (row == null) {
					fixedExpenseRepository.save(FixedExpense.sync(user, subscription.subscriptionId(),
							subscription.subscriptionName(), subscription.amount(), paymentDay));
					created++;
				} else {
					row.syncFrom(subscription.subscriptionName(), subscription.amount(), paymentDay);
					updated++;
				}
			} else if (row != null && row.isActive()) {
				row.deactivate();
				deactivated++;
			}
		}
		for (FixedExpense row : existing.values()) {
			if (row.isActive() && !seen.contains(row.getFinSubscriptionId())) {
				row.deactivate();
				deactivated++;
			}
		}
		return new SyncResult(true, created, updated, deactivated, skipped);
	}

	public record SyncResult(boolean connected, int created, int updated, int deactivated, int skipped) {

		static final SyncResult NOT_CONNECTED = new SyncResult(false, 0, 0, 0, 0);
	}
}
