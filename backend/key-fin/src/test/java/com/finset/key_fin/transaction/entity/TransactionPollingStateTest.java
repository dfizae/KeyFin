package com.finset.key_fin.transaction.entity;

import com.finset.key_fin.user.entity.User;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TransactionPollingStateTest {

	@Test
	void 최초_폴링_상태는_마지막_폴링_시각이_없다() {
		User user = User.create("qwer@qwer.com", "password", "김예린");

		TransactionPollingState state = TransactionPollingState.create(
				user, TransactionAssetType.ACCOUNT, 1L);

		assertThat(state.getUser()).isSameAs(user);
		assertThat(state.getAssetType()).isEqualTo(TransactionAssetType.ACCOUNT);
		assertThat(state.getAssetId()).isEqualTo(1L);
		assertThat(state.getLastPolledAt()).isNull();
	}

	@Test
	void 폴링이_성공하면_마지막_폴링_시각을_변경한다() {
		User user = User.create("qwer@qwer.com", "password", "김예린");
		TransactionPollingState state = TransactionPollingState.create(
				user, TransactionAssetType.CARD, 7L);
		LocalDateTime syncedAt = LocalDateTime.of(2026, 9, 15, 10, 30);

		state.recordPollingSuccess(syncedAt);

		assertThat(state.getLastPolledAt()).isEqualTo(syncedAt);
	}

	@Test
	void 자산_ID는_양수여야_한다() {
		User user = User.create("qwer@qwer.com", "password", "김예린");

		assertThatThrownBy(() -> TransactionPollingState.create(
				user, TransactionAssetType.ACCOUNT, 0L))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessage("assetId must be positive");
	}
}
