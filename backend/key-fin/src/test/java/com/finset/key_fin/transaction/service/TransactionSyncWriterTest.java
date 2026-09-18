package com.finset.key_fin.transaction.service;

import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.transaction.entity.Transaction;
import com.finset.key_fin.transaction.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class TransactionSyncWriterTest {

	@Mock
	private AccountRepository accountRepository;

	@Mock
	private TransactionRepository transactionRepository;

	@InjectMocks
	private TransactionSyncWriter syncWriter;

	@Test
	void 거래와_계좌_잔액을_함께_저장한다() {
		Account account = mock(Account.class);
		Transaction reclassifiedTransaction = mock(Transaction.class);
		Transaction newTransaction = mock(Transaction.class);

		syncWriter.save(
				List.of(account),
				List.of(newTransaction),
				Map.of(10L, reclassifiedTransaction)
		);

		verify(transactionRepository).saveAll(List.of(reclassifiedTransaction, newTransaction));
		verify(accountRepository).saveAll(List.of(account));
	}
}
