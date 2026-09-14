package com.finset.key_fin.user.service;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.user.dto.request.TransferSettingsUpdateRequest;
import com.finset.key_fin.user.dto.response.TransferSettingsResponse;
import com.finset.key_fin.user.entity.User;
import com.finset.key_fin.user.entity.UserSettings;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import com.finset.key_fin.user.repository.UserSettingsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class TransferSettingsServiceTest {

	private static final long USER_ID = 1L;

	@Mock
	private UserRepository userRepository;

	@Mock
	private UserSettingsRepository userSettingsRepository;

	@InjectMocks
	private TransferSettingsService transferSettingsService;

	private User user;
	private UserSettings settings;

	@BeforeEach
	void setUp() {
		user = User.create("qwer@qwer.com", "encoded-password", "김예린");
		ReflectionTestUtils.setField(user, "id", USER_ID);
		settings = UserSettings.create(user);
	}

	@Test
	void 이체_설정을_조회한다() {
		settings.updateTransferSettings(true, 1_000_000L, 2_000_000L);
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(userSettingsRepository.findById(USER_ID)).willReturn(Optional.of(settings));

		TransferSettingsResponse response = transferSettingsService.getTransferSettings(USER_ID);

		assertThat(response)
				.extracting("transferConsent", "transferLimitOnce", "transferLimitDaily")
				.containsExactly(true, 1_000_000L, 2_000_000L);
	}

	@Test
	void 이체_설정을_변경한다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(userSettingsRepository.findById(USER_ID)).willReturn(Optional.of(settings));

		TransferSettingsResponse response = transferSettingsService.updateTransferSettings(
				USER_ID, new TransferSettingsUpdateRequest(true, 1_000_000L, 2_000_000L));

		assertThat(response.transferConsent()).isTrue();
		assertThat(settings.getTransferLimitOnce()).isEqualTo(1_000_000L);
		assertThat(settings.getTransferLimitDaily()).isEqualTo(2_000_000L);
	}

	@Test
	void 이체_한도를_null로_변경한다() {
		settings.updateTransferSettings(true, 1_000_000L, 2_000_000L);
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(userSettingsRepository.findById(USER_ID)).willReturn(Optional.of(settings));

		TransferSettingsResponse response = transferSettingsService.updateTransferSettings(
				USER_ID, new TransferSettingsUpdateRequest(false, null, null));

		assertThat(response.transferConsent()).isFalse();
		assertThat(response.transferLimitOnce()).isNull();
		assertThat(response.transferLimitDaily()).isNull();
	}

	@Test
	void 활성_사용자가_없으면_설정을_조회할_수_없다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.empty());

		assertThatThrownBy(() -> transferSettingsService.getTransferSettings(USER_ID))
				.isInstanceOfSatisfying(BusinessException.class,
						exception -> assertThat(exception.getErrorCode()).isEqualTo(UserErrorCode.USER_NOT_FOUND));
		verifyNoInteractions(userSettingsRepository);
	}

	@Test
	void 사용자_설정이_없으면_오류를_반환한다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(userSettingsRepository.findById(USER_ID)).willReturn(Optional.empty());

		assertThatThrownBy(() -> transferSettingsService.getTransferSettings(USER_ID))
				.isInstanceOfSatisfying(BusinessException.class,
						exception -> assertThat(exception.getErrorCode())
								.isEqualTo(UserErrorCode.USER_SETTINGS_NOT_FOUND));
	}

	@Test
	void 일일_한도가_일회_한도보다_작으면_변경할_수_없다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(userSettingsRepository.findById(USER_ID)).willReturn(Optional.of(settings));

		assertThatThrownBy(() -> transferSettingsService.updateTransferSettings(
				USER_ID, new TransferSettingsUpdateRequest(true, 1_000_000L, 500_000L)))
				.isInstanceOfSatisfying(BusinessException.class,
						exception -> assertThat(exception.getErrorCode())
								.isEqualTo(UserErrorCode.INVALID_TRANSFER_LIMIT));
	}
}
