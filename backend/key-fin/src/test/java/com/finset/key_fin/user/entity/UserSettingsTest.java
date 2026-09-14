package com.finset.key_fin.user.entity;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.user.exception.UserErrorCode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserSettingsTest {

	@Test
	void defaultsBudgetAnchorDayToFirstDay() {
		User user = User.create("kim@ssafy.io", "encoded-password", "김싸피");

		UserSettings settings = UserSettings.create(user);

		assertThat(settings.getBudgetAnchorDay()).isEqualTo(1);
		assertThat(settings.isTransferConsent()).isFalse();
		assertThat(settings.getTransferLimitOnce()).isNull();
		assertThat(settings.getTransferLimitDaily()).isNull();
	}

	@Test
	void updatesTransferSettings() {
		UserSettings settings = UserSettings.create(
				User.create("kim@ssafy.io", "encoded-password", "김싸피"));

		settings.updateTransferSettings(true, 1_000_000L, 2_000_000L);

		assertThat(settings.isTransferConsent()).isTrue();
		assertThat(settings.getTransferLimitOnce()).isEqualTo(1_000_000L);
		assertThat(settings.getTransferLimitDaily()).isEqualTo(2_000_000L);
	}

	@Test
	void allowsUnsetTransferLimits() {
		UserSettings settings = UserSettings.create(
				User.create("kim@ssafy.io", "encoded-password", "김싸피"));

		settings.updateTransferSettings(true, null, null);

		assertThat(settings.isTransferConsent()).isTrue();
		assertThat(settings.getTransferLimitOnce()).isNull();
		assertThat(settings.getTransferLimitDaily()).isNull();
	}

	@Test
	void rejectsNonPositiveTransferLimit() {
		UserSettings settings = UserSettings.create(
				User.create("kim@ssafy.io", "encoded-password", "김싸피"));

		assertThatThrownBy(() -> settings.updateTransferSettings(true, 0L, null))
				.isInstanceOfSatisfying(BusinessException.class,
						exception -> assertThat(exception.getErrorCode())
								.isEqualTo(UserErrorCode.INVALID_TRANSFER_LIMIT));
	}

	@Test
	void rejectsDailyLimitSmallerThanOneTimeLimit() {
		UserSettings settings = UserSettings.create(
				User.create("kim@ssafy.io", "encoded-password", "김싸피"));

		assertThatThrownBy(() -> settings.updateTransferSettings(true, 1_000_000L, 500_000L))
				.isInstanceOfSatisfying(BusinessException.class,
						exception -> assertThat(exception.getErrorCode())
								.isEqualTo(UserErrorCode.INVALID_TRANSFER_LIMIT));
	}
}
