package com.finset.key_fin.transaction.service;

import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.card.entity.Card;
import com.finset.key_fin.card.repository.CardRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.global.finance.exception.FinanceErrorCode;
import com.finset.key_fin.transaction.entity.TransactionAssetType;
import com.finset.key_fin.user.entity.User;
import com.finset.key_fin.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class TransactionPollingServiceTest {

	private static final long USER_ID = 1L;
	private static final LocalDateTime POLLING_TIME = LocalDateTime.of(2026, 9, 15, 10, 30);
	private static final LocalDate TODAY = POLLING_TIME.toLocalDate();
	private static final LocalDate START_DATE = TODAY.minusDays(1);

	@Mock
	private UserRepository userRepository;
	@Mock
	private AccountRepository accountRepository;
	@Mock
	private CardRepository cardRepository;
	@Mock
	private TransactionSyncService transactionSyncService;
	@Mock
	private TransactionPollingStateService pollingStateService;

	private TransactionPollingService pollingService;
	private User user;
	private Account account;
	private Card card;

	@BeforeEach
	void setUp() {
		pollingService = new TransactionPollingService(
				userRepository,
				accountRepository,
				cardRepository,
				transactionSyncService,
				pollingStateService
		);
		user = User.create("qwer@qwer.com", "password", "김예린");
		ReflectionTestUtils.setField(user, "id", USER_ID);
		user.connectFinance("finance-user-key");
		account = managedAccount(3L);
		card = managedCard(7L, account);
	}

	@Test
	void 사용자의_관리_계좌와_카드를_하나씩_폴링한다() {
		givenPollingTargets();
		givenPollingStartDate(TransactionAssetType.ACCOUNT, account.getId());
		givenPollingStartDate(TransactionAssetType.CARD, card.getId());

		pollingService.pollUser(USER_ID, POLLING_TIME);

		verify(transactionSyncService).syncAccountTransactions(user, account, START_DATE, TODAY);
		verify(transactionSyncService).syncCardTransactions(user, card, START_DATE, TODAY);
		verify(pollingStateService).recordPollingSuccess(
				user, TransactionAssetType.ACCOUNT, account.getId(), POLLING_TIME);
		verify(pollingStateService).recordPollingSuccess(
				user, TransactionAssetType.CARD, card.getId(), POLLING_TIME);
	}

	@Test
	void 계좌_폴링이_실패해도_카드_폴링을_계속한다() {
		givenPollingTargets();
		givenPollingStartDate(TransactionAssetType.ACCOUNT, account.getId());
		givenPollingStartDate(TransactionAssetType.CARD, card.getId());
		doThrow(new BusinessException(FinanceErrorCode.SERVICE_UNAVAILABLE))
				.when(transactionSyncService)
				.syncAccountTransactions(user, account, START_DATE, TODAY);

		pollingService.pollUser(USER_ID, POLLING_TIME);

		verify(pollingStateService, never()).recordPollingSuccess(
				user, TransactionAssetType.ACCOUNT, account.getId(), POLLING_TIME);
		verify(transactionSyncService).syncCardTransactions(user, card, START_DATE, TODAY);
		verify(pollingStateService).recordPollingSuccess(
				user, TransactionAssetType.CARD, card.getId(), POLLING_TIME);
	}

	@Test
	void 금융_사용자_키가_무효하면_해당_사용자의_남은_폴링을_중단한다() {
		givenPollingTargets();
		givenPollingStartDate(TransactionAssetType.ACCOUNT, account.getId());
		doThrow(new BusinessException(FinanceErrorCode.USER_KEY_INVALID))
				.when(transactionSyncService)
				.syncAccountTransactions(user, account, START_DATE, TODAY);

		pollingService.pollUser(USER_ID, POLLING_TIME);

		verify(transactionSyncService, never()).syncCardTransactions(
				user, card, START_DATE, TODAY);
		verify(pollingStateService, never()).recordPollingSuccess(
				user, TransactionAssetType.ACCOUNT, account.getId(), POLLING_TIME);
	}

	private void givenPollingTargets() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(accountRepository.findAllByUserIdAndManagedTrueOrderByIdAsc(USER_ID))
				.willReturn(List.of(account));
		given(cardRepository.findAllByUserIdAndManagedTrueOrderByIdAsc(USER_ID))
				.willReturn(List.of(card));
	}

	private void givenPollingStartDate(TransactionAssetType assetType, long assetId) {
		given(pollingStateService.calculatePollingStartDate(
				USER_ID, assetType, assetId, TODAY)).willReturn(START_DATE);
	}

	private Account managedAccount(long id) {
		Account account = Account.sync(
				user,
				"0016174648358792",
				"001",
				"한국은행",
				1_000_000L,
				LocalDateTime.of(2026, 9, 15, 9, 0)
		);
		account.link();
		ReflectionTestUtils.setField(account, "id", id);
		return account;
	}

	private Card managedCard(long id, Account withdrawalAccount) {
		Card card = Card.sync(
				user,
				"1005518816096479",
				"725",
				"1005",
				"신한 TRAVEL 카드",
				withdrawalAccount
		);
		card.link();
		ReflectionTestUtils.setField(card, "id", id);
		return card;
	}
}
