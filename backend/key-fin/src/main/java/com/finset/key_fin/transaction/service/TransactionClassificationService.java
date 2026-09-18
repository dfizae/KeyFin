package com.finset.key_fin.transaction.service;

import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.card.entity.Card;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.global.finance.exception.FinanceErrorCode;
import com.finset.key_fin.transaction.dto.finance.response.FinanceAccountTransaction;
import com.finset.key_fin.transaction.dto.finance.response.FinanceCardTransaction;
import com.finset.key_fin.transaction.entity.ConfirmStatus;
import com.finset.key_fin.transaction.entity.ExcludeTag;
import com.finset.key_fin.transaction.entity.Transaction;
import com.finset.key_fin.transaction.entity.TransactionStatus;
import com.finset.key_fin.transaction.entity.TransactionType;
import com.finset.key_fin.transaction.repository.MerchantClassification;
import com.finset.key_fin.transaction.repository.MerchantClassificationRepository;
import com.finset.key_fin.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class TransactionClassificationService {

	private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;
	private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HHmmss");
	private static final String CARD_APPROVED = "승인";
	private static final String CARD_CANCELED = "취소";

	private final AccountRepository accountRepository;
	private final MerchantClassificationRepository merchantClassificationRepository;

	public Transaction fromAccount(
			User user,
			Account account,
			FinanceAccountTransaction financeTransaction
	) {
		boolean transfer = isTransfer(financeTransaction.transactionTypeName());
		boolean ownAccountTransfer = transfer
				&& hasText(financeTransaction.transactionAccountNo())
				&& accountRepository.findByUserIdAndFinAccountNoAndManagedTrue(
						user.getId(), financeTransaction.transactionAccountNo()).isPresent();

		TransactionType transactionType = accountTransactionType(
				financeTransaction.transactionTypeName(), ownAccountTransfer
		);
		ConfirmStatus confirmStatus;
		ExcludeTag excludeTag;

		if (ownAccountTransfer) {
			confirmStatus = ConfirmStatus.CONFIRMED;
			excludeTag = ExcludeTag.SELF_TRANSFER;
		} else if (transactionType == TransactionType.DEPOSIT) {
			confirmStatus = ConfirmStatus.AUTO;
			excludeTag = ExcludeTag.NONE;
		} else {
			confirmStatus = ConfirmStatus.PENDING;
			excludeTag = ExcludeTag.NONE;
		}

		return Transaction.collectAccount(
				user,
				account.getId(),
				financeTransaction.transactionUniqueNo(),
				transactionType,
				firstNonBlank(financeTransaction.transactionSummary(), financeTransaction.transactionMemo()),
				financeTransaction.transactionBalance(),
				parseDate(financeTransaction.transactionDate()),
				parseTime(financeTransaction.transactionTime()),
				confirmStatus,
				excludeTag
		);
	}

	public Transaction fromCard(
			User user,
			Card card,
			FinanceCardTransaction financeTransaction
	) {
		MerchantClassification classification = findMerchantClassification(financeTransaction.merchantId());
		Long merchantId = null;
		Integer subcategoryId = null;
		ConfirmStatus confirmStatus = ConfirmStatus.PENDING;

		if (classification != null) {
			merchantId = classification.merchantId();
			subcategoryId = classification.subcategoryId();
			confirmStatus = ConfirmStatus.AUTO;
		}

		return Transaction.collectCard(
				user,
				card.getId(),
				financeTransaction.transactionUniqueNo(),
				merchantId,
				financeTransaction.merchantName(),
				financeTransaction.transactionBalance(),
				parseDate(financeTransaction.transactionDate()),
				parseTime(financeTransaction.transactionTime()),
				subcategoryId,
				confirmStatus,
				cardStatus(financeTransaction.cardStatus())
		);
	}

	private MerchantClassification findMerchantClassification(Long financeMerchantId) {
		if (financeMerchantId == null) {
			return null;
		}
		return merchantClassificationRepository
				.findByFinanceMerchantId(financeMerchantId)
				.orElse(null);
	}

	private TransactionType accountTransactionType(String transactionTypeName, boolean ownAccountTransfer) {
		if (!hasText(transactionTypeName)) {
			throw invalidResponse();
		}
		if (ownAccountTransfer || transactionTypeName.contains("출금(이체)")) {
			return TransactionType.TRANSFER;
		}
		if (transactionTypeName.startsWith("입금")) {
			return TransactionType.DEPOSIT;
		}
		if (transactionTypeName.startsWith("출금")) {
			return TransactionType.WITHDRAW;
		}
		throw invalidResponse();
	}

	private TransactionStatus cardStatus(String status) {
		if (CARD_APPROVED.equals(status)) {
			return TransactionStatus.NORMAL;
		}
		if (CARD_CANCELED.equals(status)) {
			return TransactionStatus.CANCELED;
		}
		throw invalidResponse();
	}

	private boolean isTransfer(String transactionTypeName) {
		return "입금(이체)".equals(transactionTypeName) || "출금(이체)".equals(transactionTypeName);
	}

	private LocalDate parseDate(String value) {
		try {
			return LocalDate.parse(value, DATE_FORMAT);
		} catch (DateTimeException | NullPointerException exception) {
			throw invalidResponse(exception);
		}
	}

	private LocalTime parseTime(String value) {
		try {
			return LocalTime.parse(value, TIME_FORMAT);
		} catch (DateTimeException | NullPointerException exception) {
			throw invalidResponse(exception);
		}
	}

	private String firstNonBlank(String first, String second) {
		if (hasText(first)) {
			return first;
		}
		return second;
	}

	private boolean hasText(String value) {
		return value != null && !value.isBlank();
	}

	private BusinessException invalidResponse() {
		return new BusinessException(FinanceErrorCode.INVALID_RESPONSE);
	}

	private BusinessException invalidResponse(Throwable cause) {
		return new BusinessException(FinanceErrorCode.INVALID_RESPONSE, cause);
	}
}
