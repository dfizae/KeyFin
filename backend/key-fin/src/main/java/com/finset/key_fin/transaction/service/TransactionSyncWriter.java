package com.finset.key_fin.transaction.service;

import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.transaction.entity.ConfirmStatus;
import com.finset.key_fin.transaction.entity.Transaction;
import com.finset.key_fin.transaction.entity.TransactionStatus;
import com.finset.key_fin.transaction.entity.TransactionType;
import com.finset.key_fin.transaction.event.PendingTransactionSaved;
import com.finset.key_fin.transaction.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class TransactionSyncWriter {

	private final AccountRepository accountRepository;
	private final TransactionRepository transactionRepository;
	private final ApplicationEventPublisher events;


	@Transactional
	public void save(
			List<Account> balanceUpdatedAccounts,
			List<Transaction> newTransactions,
			Map<Long, Transaction> reclassifiedTransactions
	) {
		persist(balanceUpdatedAccounts, newTransactions, reclassifiedTransactions);
		publishPendingTransactionEvents(newTransactions);
	}

	@Transactional
	public void saveHistory(
			List<Account> balanceUpdatedAccounts,
			List<Transaction> newTransactions,
			Map<Long, Transaction> reclassifiedTransactions
	) {
		persist(balanceUpdatedAccounts, newTransactions, reclassifiedTransactions);
	}

	private void persist(
			List<Account> balanceUpdatedAccounts,
			List<Transaction> newTransactions,
			Map<Long, Transaction> reclassifiedTransactions
	) {
		List<Transaction> transactionsToSave = new ArrayList<>(reclassifiedTransactions.values());
		transactionsToSave.addAll(newTransactions);

		if (!transactionsToSave.isEmpty()) {
			transactionRepository.saveAll(transactionsToSave);
		}
		if (!balanceUpdatedAccounts.isEmpty()) {
			accountRepository.saveAll(balanceUpdatedAccounts);
		}
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
