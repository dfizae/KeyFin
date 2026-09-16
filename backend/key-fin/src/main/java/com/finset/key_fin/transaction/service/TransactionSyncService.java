package com.finset.key_fin.transaction.service;

import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.card.entity.Card;
import com.finset.key_fin.card.repository.CardRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.link.exception.LinkErrorCode;
import com.finset.key_fin.transaction.client.FinanceAccountTransactionClient;
import com.finset.key_fin.transaction.client.FinanceCardTransactionClient;
import com.finset.key_fin.transaction.dto.finance.response.FinanceAccountTransaction;
import com.finset.key_fin.transaction.dto.finance.response.FinanceCardTransaction;
import com.finset.key_fin.transaction.entity.ConfirmStatus;
import com.finset.key_fin.transaction.entity.ExcludeTag;
import com.finset.key_fin.transaction.entity.Transaction;
import com.finset.key_fin.transaction.entity.TransactionStatus;
import com.finset.key_fin.transaction.repository.TransactionRepository;
import com.finset.key_fin.user.entity.User;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TransactionSyncService {

	private static final List<ConfirmStatus> RECLASSIFIABLE_STATUSES = List.of(
			ConfirmStatus.PENDING,
			ConfirmStatus.AUTO
	);

	private final UserRepository userRepository;
	private final AccountRepository accountRepository;
	private final CardRepository cardRepository;
	private final TransactionRepository transactionRepository;
	private final FinanceAccountTransactionClient accountTransactionClient;
	private final FinanceCardTransactionClient cardTransactionClient;
	private final TransactionClassificationService classificationService;

	public void sync(long userId, LocalDate startDate, LocalDate endDate) {
		validatePeriod(startDate, endDate);
		User user = requireActiveUser(userId);
		String userKey = requireFinanceUserKey(user);
		List<Account> accounts = accountRepository.findAllByUserIdAndManagedTrueOrderByIdAsc(userId);
		List<Card> cards = cardRepository.findAllByUserIdAndManagedTrueOrderByIdAsc(userId);
		List<Transaction> newTransactions = new ArrayList<>();
		Set<String> transactionNumbers = new HashSet<>();
		syncAccountTransactions(
				user, userKey, accounts, startDate, endDate,
				transactionNumbers, newTransactions);
		syncCardTransactions(
				user, userKey, cards, startDate, endDate,
				transactionNumbers, newTransactions);
		saveTransactions(newTransactions, Map.of());
	}

	public void syncAccountTransactions(
			User user,
			Account account,
			LocalDate startDate,
			LocalDate endDate
	) {
		validatePeriod(startDate, endDate);
		validateManagedAccount(user, account);
		String userKey = requireFinanceUserKey(user);
		List<Transaction> newTransactions = new ArrayList<>();
		syncAccountTransactions(
				user, userKey, List.of(account), startDate, endDate,
				new HashSet<>(), newTransactions);
		saveTransactions(newTransactions, Map.of());
	}

	public void syncCardTransactions(
			User user,
			Card card,
			LocalDate startDate,
			LocalDate endDate
	) {
		validatePeriod(startDate, endDate);
		validateManagedCard(user, card);
		String userKey = requireFinanceUserKey(user);
		List<Transaction> newTransactions = new ArrayList<>();
		syncCardTransactions(
				user, userKey, List.of(card), startDate, endDate,
				new HashSet<>(), newTransactions);
		saveTransactions(newTransactions, Map.of());
	}

	public void syncNewlyManagedAccountHistory(
			long userId,
			long accountId,
			LocalDate startDate,
			LocalDate endDate
	) {
		validatePeriod(startDate, endDate);
		User user = requireActiveUser(userId);
		String userKey = requireFinanceUserKey(user);
		Account account = requireManagedAccount(userId, accountId);
		List<Transaction> newTransactions = new ArrayList<>();
		Map<Long, Transaction> reclassifiedTransactions = new LinkedHashMap<>();

		syncNewlyManagedAccountTransactions(
				user, userKey, account, startDate, endDate,
				new HashSet<>(), newTransactions, reclassifiedTransactions);
		saveTransactions(newTransactions, reclassifiedTransactions);
	}

	private void syncAccountTransactions(
			User user,
			String userKey,
			List<Account> accounts,
			LocalDate startDate,
			LocalDate endDate,
			Set<String> transactionNumbers,
			List<Transaction> newTransactions
	) {
		for (Account account : accounts) {
			List<FinanceAccountTransaction> financeTransactions = accountTransactionClient.findTransactions(
					userKey, account.getFinAccountNo(), startDate, endDate);
			for (FinanceAccountTransaction financeTransaction : financeTransactions) {
				if (isDuplicate(user.getId(), financeTransaction.transactionUniqueNo(), transactionNumbers)) {
					continue;
				}
				Transaction transaction = classificationService.fromAccount(user, account, financeTransaction);
				newTransactions.add(transaction);
			}
		}
	}

	private void syncNewlyManagedAccountTransactions(
			User user,
			String userKey,
			Account account,
			LocalDate startDate,
			LocalDate endDate,
			Set<String> transactionNumbers,
			List<Transaction> newTransactions,
			Map<Long, Transaction> reclassifiedTransactions
	) {
		List<FinanceAccountTransaction> financeTransactions = accountTransactionClient.findTransactions(
				userKey, account.getFinAccountNo(), startDate, endDate);
		for (FinanceAccountTransaction financeTransaction : financeTransactions) {
			if (isDuplicate(user.getId(), financeTransaction.transactionUniqueNo(), transactionNumbers)) {
				continue;
			}
			Transaction transaction = classificationService.fromAccount(user, account, financeTransaction);
			reclassifyCounterpart(
					user.getId(), transaction, financeTransaction, reclassifiedTransactions);
			newTransactions.add(transaction);
		}
	}

	private void syncCardTransactions(
			User user,
			String userKey,
			List<Card> cards,
			LocalDate startDate,
			LocalDate endDate,
			Set<String> transactionNumbers,
			List<Transaction> newTransactions
	) {
		for (Card card : cards) {
			List<FinanceCardTransaction> financeTransactions = cardTransactionClient.findTransactions(
					userKey, card.getFinCardNo(), card.getCvc(), startDate, endDate);
			for (FinanceCardTransaction financeTransaction : financeTransactions) {
				if (isDuplicate(user.getId(), financeTransaction.transactionUniqueNo(), transactionNumbers)) {
					continue;
				}
				newTransactions.add(classificationService.fromCard(user, card, financeTransaction));
			}
		}
	}

	private void saveTransactions(
			List<Transaction> newTransactions,
			Map<Long, Transaction> reclassifiedTransactions
	) {
		List<Transaction> transactionsToSave = new ArrayList<>(reclassifiedTransactions.values());
		transactionsToSave.addAll(newTransactions);
		if (!transactionsToSave.isEmpty()) {
			transactionRepository.saveAll(transactionsToSave);
		}
	}

	private boolean isDuplicate(long userId, String transactionNumber, Set<String> transactionNumbers) {
		if (!transactionNumbers.add(transactionNumber)) {
			return true;
		}
		return transactionRepository.existsByUserIdAndFinTransactionUniqueNo(userId, transactionNumber);
	}

	private void reclassifyCounterpart(
			long userId,
			Transaction transaction,
			FinanceAccountTransaction financeTransaction,
			Map<Long, Transaction> reclassifiedTransactions
	) {
		if (transaction.getExcludeTag() != ExcludeTag.SELF_TRANSFER) {
			return;
		}
		accountRepository.findByUserIdAndFinAccountNoAndManagedTrue(
					userId, financeTransaction.transactionAccountNo())
				.flatMap(counterpartAccount -> transactionRepository
						.findFirstByUserIdAndAccountIdAndTransactionDateAndTransactionTimeAndAmountAndStatusAndExcludeTagNotAndConfirmStatusInOrderByIdDesc(
								userId,
								counterpartAccount.getId(),
								transaction.getTransactionDate(),
								transaction.getTransactionTime(),
								transaction.getAmount(),
								TransactionStatus.NORMAL,
								ExcludeTag.SELF_TRANSFER,
								RECLASSIFIABLE_STATUSES
						))
				.ifPresent(counterpartTransaction -> {
					counterpartTransaction.markAsSelfTransfer();
					reclassifiedTransactions.put(counterpartTransaction.getId(), counterpartTransaction);
				});
	}

	private User requireActiveUser(long userId) {
		return userRepository.findByIdAndDeletedAtIsNull(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
	}

	private Account requireManagedAccount(long userId, long accountId) {
		Account account = accountRepository.findByIdAndUserId(accountId, userId)
				.orElseThrow(() -> new BusinessException(LinkErrorCode.ACCOUNT_NOT_FOUND));
		if (!account.isManaged()) {
			throw new BusinessException(LinkErrorCode.ACCOUNT_NOT_FOUND);
		}
		return account;
	}

	private void validateManagedAccount(User user, Account account) {
		if (user == null || account == null || !account.isManaged()
				|| !user.getId().equals(account.getUser().getId())) {
			throw new BusinessException(LinkErrorCode.ACCOUNT_NOT_FOUND);
		}
	}

	private void validateManagedCard(User user, Card card) {
		if (user == null || card == null || !card.isManaged()
				|| !user.getId().equals(card.getUser().getId())) {
			throw new BusinessException(LinkErrorCode.CARD_NOT_FOUND);
		}
	}

	private String requireFinanceUserKey(User user) {
		if (!user.isFinanceConnected()) {
			throw new BusinessException(LinkErrorCode.FINANCE_NOT_CONNECTED);
		}
		return user.getFinUserKey();
	}

	private void validatePeriod(LocalDate startDate, LocalDate endDate) {
		if (startDate == null || endDate == null || startDate.isAfter(endDate)) {
			throw new IllegalArgumentException("거래 조회 기간이 올바르지 않습니다.");
		}
	}
}
