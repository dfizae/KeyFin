package com.finset.key_fin.user.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UserSettingsTest {

	@Test
	void defaultsBudgetAnchorDayToFirstDay() {
		User user = User.create("kim@ssafy.io", "encoded-password", "김싸피");

		UserSettings settings = UserSettings.create(user);

		assertThat(settings.getBudgetAnchorDay()).isEqualTo(1);
	}
}
