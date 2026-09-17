package com.finset.key_fin.transaction.service;

import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.transaction.entity.Transaction;
import com.finset.key_fin.transaction.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
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

	@Transactional
	public void save(
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
}
