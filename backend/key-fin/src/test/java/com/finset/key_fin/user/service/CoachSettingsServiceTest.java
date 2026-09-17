package com.finset.key_fin.user.service;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.user.dto.request.CoachPersonaUpdateRequest;
import com.finset.key_fin.user.entity.CoachPersona;
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
class CoachSettingsServiceTest {

	private static final long USER_ID = 1L;

	@Mock
	private UserRepository userRepository;

	@Mock
	private UserSettingsRepository userSettingsRepository;

	@InjectMocks
	private CoachSettingsService coachSettingsService;

	private User user;
	private UserSettings settings;

	@BeforeEach
	void setUp() {
		user = User.create("qwer@qwer.com", "encoded-password", "김예린");
		ReflectionTestUtils.setField(user, "id", USER_ID);
		settings = UserSettings.create(user);
	}

	@Test
	void 코치_말투를_변경한다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(userSettingsRepository.findById(USER_ID)).willReturn(Optional.of(settings));

		coachSettingsService.updateCoachPersona(
				USER_ID, new CoachPersonaUpdateRequest(CoachPersona.DODO));

		assertThat(settings.getCoachPersona()).isEqualTo(CoachPersona.DODO);
	}

	@Test
	void 활성_사용자가_아니면_코치_말투를_변경할_수_없다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.empty());

		assertThatThrownBy(() -> coachSettingsService.updateCoachPersona(
				USER_ID, new CoachPersonaUpdateRequest(CoachPersona.DODO)))
				.isInstanceOfSatisfying(BusinessException.class,
						exception -> assertThat(exception.getErrorCode()).isEqualTo(UserErrorCode.USER_NOT_FOUND));
		verifyNoInteractions(userSettingsRepository);
	}

	@Test
	void 사용자_설정이_없으면_코치_말투를_변경할_수_없다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(userSettingsRepository.findById(USER_ID)).willReturn(Optional.empty());

		assertThatThrownBy(() -> coachSettingsService.updateCoachPersona(
				USER_ID, new CoachPersonaUpdateRequest(CoachPersona.DODO)))
				.isInstanceOfSatisfying(BusinessException.class,
						exception -> assertThat(exception.getErrorCode())
								.isEqualTo(UserErrorCode.USER_SETTINGS_NOT_FOUND));
	}
}
