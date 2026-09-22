package com.finset.key_fin.transaction.service;

import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.transaction.entity.ConfirmStatus;
import com.finset.key_fin.transaction.entity.Transaction;
import com.finset.key_fin.transaction.entity.TransactionStatus;
import com.finset.key_fin.transaction.entity.TransactionType;
import com.finset.key_fin.transaction.event.AccountWithdrawn;
import com.finset.key_fin.transaction.event.PendingTransactionSaved;
import com.finset.key_fin.budget.event.EnvelopeSpendingChanged;
import com.finset.key_fin.transaction.repository.SubcategoryQueryRepository;
import com.finset.key_fin.transaction.repository.TransactionRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.room.service.RoomStickerService;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class TransactionSyncWriter {

	private final AccountRepository accountRepository;
	private final TransactionRepository transactionRepository;
	private final ApplicationEventPublisher events;
	private final UserRepository userRepository;
	private final RoomStickerService roomStickerService;
	private final SubcategoryQueryRepository subcategoryQueryRepository;

	@Transactional
	public void save(
			long userId,
			List<Account> balanceUpdatedAccounts,
			List<Transaction> newTransactions,
			Map<Long, Transaction> reclassifiedTransactions
	) {
		persist(userId, balanceUpdatedAccounts, newTransactions, reclassifiedTransactions);
		publishPendingTransactionEvents(newTransactions);
		publishAccountWithdrawnEvents(newTransactions);
		publishEnvelopeSpendingEvents(userId, newTransactions);
	}

	@Transactional
	public void saveHistory(
			long userId,
			List<Account> balanceUpdatedAccounts,
			List<Transaction> newTransactions,
			Map<Long, Transaction> reclassifiedTransactions
	) {
		persist(userId, balanceUpdatedAccounts, newTransactions, reclassifiedTransactions);
	}

	private void persist(
			long userId,
			List<Account> balanceUpdatedAccounts,
			List<Transaction> newTransactions,
			Map<Long, Transaction> reclassifiedTransactions
	) {
		userRepository.findActiveByIdForUpdate(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
		List<Transaction> transactionsToSave = new ArrayList<>(reclassifiedTransactions.values());
		transactionsToSave.addAll(newTransactions);

		if (!transactionsToSave.isEmpty()) {
			transactionRepository.saveAll(transactionsToSave);
		}
		if (!balanceUpdatedAccounts.isEmpty()) {
			accountRepository.saveAll(balanceUpdatedAccounts);
		}
		roomStickerService.synchronize(userId);
	}

	private void publishAccountWithdrawnEvents(List<Transaction> newTransactions) {
		Set<Long> accountIds = new LinkedHashSet<>();
		for (Transaction transaction : newTransactions) {
			if (transaction.getAccountId() != null
					&& transaction.getStatus() == TransactionStatus.NORMAL
					&& transaction.getTransactionType() != TransactionType.DEPOSIT
					&& accountIds.add(transaction.getAccountId())) {
				events.publishEvent(new AccountWithdrawn(transaction.getUser().getId(), transaction.getAccountId()));
			}
		}
	}

	private void publishEnvelopeSpendingEvents(long userId, List<Transaction> newTransactions) {
		Map<Integer, Optional<Integer>> envelopeBySubcategory = new HashMap<>();
		Set<Integer> envelopeIds = new LinkedHashSet<>();
		for (Transaction transaction : newTransactions) {
			if (transaction.getStatus() != TransactionStatus.NORMAL
					|| transaction.getConfirmStatus() == ConfirmStatus.PENDING
					|| transaction.getSubcategoryId() == null) {
				continue;
			}
			envelopeBySubcategory
					.computeIfAbsent(transaction.getSubcategoryId(), subcategoryQueryRepository::findEnvelopeId)
					.ifPresent(envelopeIds::add);
		}
		envelopeIds.forEach(envelopeId -> events.publishEvent(new EnvelopeSpendingChanged(userId, envelopeId)));
	}

	private void publishPendingTransactionEvents(List<Transaction> newTransactions) {
		for (Transaction transaction : newTransactions) {
			if (transaction.getConfirmStatus() != ConfirmStatus.PENDING
					|| transaction.getStatus() != TransactionStatus.NORMAL
					|| transaction.getTransactionType() == TransactionType.DEPOSIT) {
				continue;
			}
			events.publishEvent(new PendingTransactionSaved(
					transaction.getUser().getId(),
					transaction.getId(),
					transaction.getMerchantNameRaw(),
					transaction.getAmount()
			));
		}
	}
}
