package com.finset.key_fin.transaction.service;

import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.card.entity.Card;
import com.finset.key_fin.card.repository.CardRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.global.finance.exception.FinanceErrorCode;
import com.finset.key_fin.link.exception.LinkErrorCode;
import com.finset.key_fin.transaction.entity.TransactionAssetType;
import com.finset.key_fin.user.entity.User;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TransactionPollingService {

	private final UserRepository userRepository;
	private final AccountRepository accountRepository;
	private final CardRepository cardRepository;
	private final TransactionSyncService transactionSyncService;
	private final TransactionPollingStateService pollingStateService;

	public void pollUser(long userId, LocalDateTime pollingTime) {
		User user = requireFinanceConnectedUser(userId);
		LocalDate today = pollingTime.toLocalDate();
		List<Account> accounts = accountRepository.findAllByUserIdAndManagedTrueOrderByIdAsc(userId);
		List<Card> cards = cardRepository.findAllByUserIdAndManagedTrueOrderByIdAsc(userId);

		if (!pollAccounts(user, accounts, today, pollingTime)) {
			return;
		}
		pollCards(user, cards, today, pollingTime);
	}

	private boolean pollAccounts(
			User user,
			List<Account> accounts,
			LocalDate today,
			LocalDateTime pollingTime
	) {
		for (Account account : accounts) {
			boolean shouldContinue = pollAccount(user, account, today, pollingTime);
			if (!shouldContinue) {
				return false;
			}
		}
		return true;
	}

	private void pollCards(
			User user,
			List<Card> cards,
			LocalDate today,
			LocalDateTime pollingTime
	) {
		for (Card card : cards) {
			boolean shouldContinue = pollCard(user, card, today, pollingTime);
			if (!shouldContinue) {
				return;
			}
		}
	}

	private boolean pollAccount(
			User user,
			Account account,
			LocalDate today,
			LocalDateTime pollingTime
	) {
		try {
			LocalDate startDate = pollingStateService.calculatePollingStartDate(
					user.getId(), TransactionAssetType.ACCOUNT, account.getId(), today);
			transactionSyncService.syncAccountTransactions(user, account, startDate, today);
			pollingStateService.recordPollingSuccess(
					user, TransactionAssetType.ACCOUNT, account.getId(), pollingTime);
			return true;
		} catch (BusinessException exception) {
			return handleBusinessFailure(
					user.getId(), TransactionAssetType.ACCOUNT, account.getId(), exception);
		} catch (RuntimeException exception) {
			logUnexpectedFailure(
					user.getId(), TransactionAssetType.ACCOUNT, account.getId(), exception);
			return true;
		}
	}

	private boolean pollCard(
			User user,
			Card card,
			LocalDate today,
			LocalDateTime pollingTime
	) {
		try {
			LocalDate startDate = pollingStateService.calculatePollingStartDate(
					user.getId(), TransactionAssetType.CARD, card.getId(), today);
			transactionSyncService.syncCardTransactions(user, card, startDate, today);
			pollingStateService.recordPollingSuccess(
					user, TransactionAssetType.CARD, card.getId(), pollingTime);
			return true;
		} catch (BusinessException exception) {
			return handleBusinessFailure(
					user.getId(), TransactionAssetType.CARD, card.getId(), exception);
		} catch (RuntimeException exception) {
			logUnexpectedFailure(
					user.getId(), TransactionAssetType.CARD, card.getId(), exception);
			return true;
		}
	}

	private boolean handleBusinessFailure(
			long userId,
			TransactionAssetType assetType,
			long assetId,
			BusinessException exception
	) {
		if (exception.getErrorCode() == FinanceErrorCode.USER_KEY_INVALID) {
			log.warn("거래 폴링 중단 — 금융 사용자 키 무효: userId={}", userId);
			return false;
		}
		log.warn(
				"거래 폴링 실패 — 다음 자산으로 진행: userId={}, assetType={}, assetId={}, code={}",
				userId, assetType, assetId, exception.getErrorCode().getCode());
		return true;
	}

	private void logUnexpectedFailure(
			long userId,
			TransactionAssetType assetType,
			long assetId,
			RuntimeException exception
	) {
		log.error(
				"거래 폴링 실패 — 다음 자산으로 진행: userId={}, assetType={}, assetId={}",
				userId, assetType, assetId, exception);
	}

	private User requireFinanceConnectedUser(long userId) {
		User user = userRepository.findByIdAndDeletedAtIsNull(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
		if (!user.isFinanceConnected()) {
			throw new BusinessException(LinkErrorCode.FINANCE_NOT_CONNECTED);
		}
		return user;
	}
}
