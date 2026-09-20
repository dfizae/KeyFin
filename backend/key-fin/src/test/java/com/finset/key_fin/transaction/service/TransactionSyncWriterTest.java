package com.finset.key_fin.transaction.service;

import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.transaction.entity.Transaction;
import com.finset.key_fin.transaction.entity.ConfirmStatus;
import com.finset.key_fin.transaction.entity.TransactionStatus;
import com.finset.key_fin.transaction.entity.TransactionType;
import com.finset.key_fin.transaction.event.AccountWithdrawn;
import com.finset.key_fin.transaction.event.PendingTransactionSaved;
import com.finset.key_fin.user.entity.User;
import com.finset.key_fin.transaction.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.BDDMockito.given;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;

@ExtendWith(MockitoExtension.class)
class TransactionSyncWriterTest {

	@Mock
	private AccountRepository accountRepository;

	@Mock
	private TransactionRepository transactionRepository;

	@Mock
	private ApplicationEventPublisher events;

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

	@Test
	void 신규_미분류_지출_거래마다_이벤트를_발행한다() {
		User user = mock(User.class);
		given(user.getId()).willReturn(1L);
		Transaction first = pendingCardTransaction(user, 10L, "메가커피 역삼점", 4_500L);
		Transaction second = pendingCardTransaction(user, 11L, "김밥천국", 9_000L);

		syncWriter.save(List.of(), List.of(first, second), Map.of());

		verify(events).publishEvent(new PendingTransactionSaved(1L, 10L, "메가커피 역삼점", 4_500L));
		verify(events).publishEvent(new PendingTransactionSaved(1L, 11L, "김밥천국", 9_000L));
	}

	@Test
	void 과거_이력_적재에는_즉시_알림_이벤트를_발행하지_않는다() {
		Transaction transaction = mock(Transaction.class);

		syncWriter.saveHistory(List.of(), List.of(transaction), Map.of());

		verify(transactionRepository).saveAll(List.of(transaction));
		verify(events, never()).publishEvent(any());
	}

	private Transaction pendingCardTransaction(User user, long id, String merchantName, long amount) {
		Transaction transaction = mock(Transaction.class);
		given(transaction.getUser()).willReturn(user);
		given(transaction.getId()).willReturn(id);
		given(transaction.getMerchantNameRaw()).willReturn(merchantName);
		given(transaction.getAmount()).willReturn(amount);
		given(transaction.getConfirmStatus()).willReturn(ConfirmStatus.PENDING);
		given(transaction.getStatus()).willReturn(TransactionStatus.NORMAL);
		given(transaction.getTransactionType()).willReturn(TransactionType.CARD);
		return transaction;
	}

	@Test
	void 입금_거래에는_미분류_이벤트를_발행하지_않는다() {
		Transaction transaction = mock(Transaction.class);
		given(transaction.getConfirmStatus()).willReturn(ConfirmStatus.PENDING);
		given(transaction.getStatus()).willReturn(TransactionStatus.NORMAL);
		given(transaction.getTransactionType()).willReturn(TransactionType.DEPOSIT);

		syncWriter.save(List.of(), List.of(transaction), Map.of());

		verify(events, never()).publishEvent(any());
	}

	@Test
	void 계좌_출금_거래는_계좌마다_한_번씩_AccountWithdrawn을_발행한다() {
		User user = mock(User.class);
		given(user.getId()).willReturn(1L);
		Transaction first = accountTransaction(20L, TransactionType.WITHDRAW);
		Transaction second = accountTransaction(20L, TransactionType.TRANSFER);
		Transaction third = accountTransaction(21L, TransactionType.WITHDRAW);
		given(first.getUser()).willReturn(user);
		given(third.getUser()).willReturn(user);

		syncWriter.save(List.of(), List.of(first, second, third), Map.of());

		verify(events, times(1)).publishEvent(new AccountWithdrawn(1L, 20L));
		verify(events, times(1)).publishEvent(new AccountWithdrawn(1L, 21L));
	}

	@Test
	void 카드_결제와_입금에는_AccountWithdrawn을_발행하지_않는다() {
		Transaction card = mock(Transaction.class);
		Transaction deposit = mock(Transaction.class);
		given(deposit.getAccountId()).willReturn(20L);
		given(deposit.getStatus()).willReturn(TransactionStatus.NORMAL);
		given(deposit.getTransactionType()).willReturn(TransactionType.DEPOSIT);

		syncWriter.save(List.of(), List.of(card, deposit), Map.of());

		verify(events, never()).publishEvent(any(AccountWithdrawn.class));
	}

	private Transaction accountTransaction(long accountId, TransactionType type) {
		Transaction transaction = mock(Transaction.class);
		given(transaction.getAccountId()).willReturn(accountId);
		given(transaction.getStatus()).willReturn(TransactionStatus.NORMAL);
		given(transaction.getTransactionType()).willReturn(type);
		return transaction;
	}
}
