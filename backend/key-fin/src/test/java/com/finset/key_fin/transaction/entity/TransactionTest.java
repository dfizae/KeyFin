package com.finset.key_fin.transaction.entity;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.transaction.exception.TransactionErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TransactionTest {

	@Test
	void appliesDatabaseDefaults() {
		Transaction transaction = new Transaction();

		assertThat(transaction.getConfirmStatus()).isEqualTo(ConfirmStatus.PENDING);
		assertThat(transaction.getExcludeTag()).isEqualTo(ExcludeTag.NONE);
		assertThat(transaction.getStatus()).isEqualTo(TransactionStatus.NORMAL);
	}

	@Test
	void supportsRestoreExcludeTag() {
		assertThat(ExcludeTag.valueOf("RESTORE")).isEqualTo(ExcludeTag.RESTORE);
	}

	@Test
	void 세분류를_확정하면_제외_정보를_초기화한다() {
		Transaction transaction = cardTransaction(40_000L);
		ReflectionTestUtils.setField(transaction, "excludeTag", ExcludeTag.DUTCH);
		ReflectionTestUtils.setField(transaction, "adjustedAmount", 20_000L);

		transaction.confirmSubcategory(102);

		assertThat(transaction.getSubcategoryId()).isEqualTo(102);
		assertThat(transaction.getExcludeTag()).isEqualTo(ExcludeTag.NONE);
		assertThat(transaction.getAdjustedAmount()).isNull();
		assertThat(transaction.getConfirmStatus()).isEqualTo(ConfirmStatus.CONFIRMED);
	}

	@Test
	void 더치페이는_실제_부담액으로_확정한다() {
		Transaction transaction = cardTransaction(40_000L);

		transaction.confirmExclusion(ExcludeTag.DUTCH, 20_000L);

		assertThat(transaction.getSubcategoryId()).isNull();
		assertThat(transaction.getExcludeTag()).isEqualTo(ExcludeTag.DUTCH);
		assertThat(transaction.getAdjustedAmount()).isEqualTo(20_000L);
		assertThat(transaction.getConfirmStatus()).isEqualTo(ConfirmStatus.CONFIRMED);
	}

	@Test
	void 더치페이_부담액이_원금보다_크면_거절한다() {
		Transaction transaction = cardTransaction(40_000L);

		assertThatThrownBy(() -> transaction.confirmExclusion(ExcludeTag.DUTCH, 40_001L))
				.isInstanceOfSatisfying(BusinessException.class,
						exception -> assertThat(exception.getErrorCode())
								.isEqualTo(TransactionErrorCode.INVALID_ADJUSTED_AMOUNT));
	}

	@Test
	void 입금_거래는_분류할_수_없다() {
		Transaction transaction = cardTransaction(40_000L);
		ReflectionTestUtils.setField(transaction, "transactionType", TransactionType.DEPOSIT);

		assertThatThrownBy(() -> transaction.confirmSubcategory(102))
				.isInstanceOfSatisfying(BusinessException.class,
						exception -> assertThat(exception.getErrorCode())
								.isEqualTo(TransactionErrorCode.CLASSIFICATION_NOT_ALLOWED));
	}

	private Transaction cardTransaction(long amount) {
		Transaction transaction = new Transaction();
		ReflectionTestUtils.setField(transaction, "transactionType", TransactionType.CARD);
		ReflectionTestUtils.setField(transaction, "amount", amount);
		return transaction;
	}
}
