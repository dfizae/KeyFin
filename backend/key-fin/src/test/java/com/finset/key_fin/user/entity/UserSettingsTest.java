package com.finset.key_fin.user.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

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

		assertThatIllegalArgumentException()
				.isThrownBy(() -> settings.updateTransferSettings(true, 0L, null))
				.withMessage("1회 이체 한도는 0보다 커야 합니다.");
	}

	@Test
	void rejectsDailyLimitSmallerThanOneTimeLimit() {
		UserSettings settings = UserSettings.create(
				User.create("kim@ssafy.io", "encoded-password", "김싸피"));

		assertThatIllegalArgumentException()
				.isThrownBy(() -> settings.updateTransferSettings(true, 1_000_000L, 500_000L))
				.withMessage("1일 이체 한도는 1회 이체 한도보다 작을 수 없습니다.");
	}
}
