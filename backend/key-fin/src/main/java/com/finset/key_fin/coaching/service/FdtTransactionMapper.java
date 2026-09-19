package com.finset.key_fin.coaching.service;

import java.time.format.DateTimeFormatter;
import java.util.List;

import org.springframework.stereotype.Component;

import com.finset.key_fin.coaching.dto.FdtTransaction;
import com.finset.key_fin.transaction.entity.ExcludeTag;
import com.finset.key_fin.transaction.entity.Transaction;
import com.finset.key_fin.transaction.entity.TransactionType;

import lombok.RequiredArgsConstructor;

/** 우리 거래를 FDT 원장 형식으로 바꾼다. */
@Component
@RequiredArgsConstructor
public class FdtTransactionMapper {

	private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm:ss");
	private static final String UNMAPPED_MERCHANT_PREFIX = "raw:";
	private static final String ENGINE_INTERNAL_TRANSFER = "INTERNAL_TRANSFER";

	private final FdtCategoryMapper categoryMapper;

	/** CARRYOVER 는 시딩 이월 마커라 원장에서 뺀다. */
	public List<FdtTransaction> map(List<Transaction> transactions) {
		return transactions.stream()
				.filter(transaction -> transaction.getExcludeTag() != ExcludeTag.CARRYOVER)
				.map(this::map)
				.toList();
	}

	public FdtTransaction map(Transaction transaction) {
		FdtCategoryMapper.Entry category = categoryMapper.of(transaction.getSubcategoryId());
		return new FdtTransaction(
				String.valueOf(transaction.getUser().getId()),
				String.valueOf(transaction.getId()),
				transaction.getSource().name(),
				transactionType(transaction),
				transaction.getTransactionDate().toString(),
				transaction.getTransactionTime().format(TIME),
				category.category(),
				category.subcategory(),
				nullToEmpty(transaction.getMerchantNameRaw()),
				merchantId(transaction),
				transaction.getAmount(),
				idToString(transaction.getAccountId()),
				idToString(transaction.getCardId()),
				transaction.getConfirmStatus().name(),
				transaction.getStatus().name(),
				excludeTag(transaction)
		);
	}

	/**
	 * RESTORE 는 봉투를 되돌리는 입금이라 FDT enum 에 없다. DEPOSIT 으로 보낸다.
	 * TRANSFER 는 태그로 갈린다 — 본인 계좌 이동만 내부 이체(TRANSFER)이고, 남에게 나가는 송금은 TRANSFER_OUT 이다.
	 */
	private String transactionType(Transaction transaction) {
		if (transaction.getExcludeTag() == ExcludeTag.RESTORE) {
			return TransactionType.DEPOSIT.name();
		}
		if (transaction.getTransactionType() != TransactionType.TRANSFER) {
			return transaction.getTransactionType().name();
		}
		return transaction.getExcludeTag() == ExcludeTag.SELF_TRANSFER ? "TRANSFER" : "TRANSFER_OUT";
	}

	/**
	 * 엔진 enum 은 NONE·INTERNAL_TRANSFER·SELF_TRANSFER·DUTCH·EMERGENCY·CARRYOVER 여섯 종이다.
	 * 여기 없는 값을 보내면 원장 적재가 통째로 거부된다.
	 */
	private String excludeTag(Transaction transaction) {
		return switch (transaction.getExcludeTag()) {
			case RESTORE -> ExcludeTag.NONE.name();
			// 예산 제외는 엔진에 대응 값이 없다. 내부 이체로 보내 봉투 집계에서 빠지게 한다.
			case BUDGET_EXCLUDED -> ENGINE_INTERNAL_TRANSFER;
			default -> transaction.getExcludeTag().name();
		};
	}

	/**
	 * 엔진이 이 값을 반복 지출 탐지의 묶음 키로 쓴다. 미매핑 가맹점에 같은 값을 주면
	 * 서로 다른 가게가 한 덩어리로 묶여 없는 정기 결제가 잡히므로 가맹점명을 붙인다.
	 */
	private String merchantId(Transaction transaction) {
		if (transaction.getCardId() == null) {
			return "";
		}
		if (transaction.getMerchantId() != null) {
			return String.valueOf(transaction.getMerchantId());
		}
		return UNMAPPED_MERCHANT_PREFIX + nullToEmpty(transaction.getMerchantNameRaw());
	}

	private static String idToString(Long id) {
		return id == null ? "" : String.valueOf(id);
	}

	private static String nullToEmpty(String value) {
		return value == null ? "" : value;
	}
}
