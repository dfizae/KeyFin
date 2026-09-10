package com.finset.key_fin.transaction.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

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
}
