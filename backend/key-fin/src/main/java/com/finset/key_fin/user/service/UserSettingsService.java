package com.finset.key_fin.user.service;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.user.dto.request.CoachPersonaUpdateRequest;
import com.finset.key_fin.user.dto.request.NotificationSettingsUpdateRequest;
import com.finset.key_fin.user.dto.request.TransferSettingsUpdateRequest;
import com.finset.key_fin.user.dto.response.CoachPersonaResponse;
import com.finset.key_fin.user.dto.response.NotificationSettingsResponse;
import com.finset.key_fin.user.dto.response.TransferSettingsResponse;
import com.finset.key_fin.user.entity.UserSettings;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import com.finset.key_fin.user.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserSettingsService {

	private final UserRepository userRepository;
	private final UserSettingsRepository userSettingsRepository;

	@Transactional(readOnly = true)
	public TransferSettingsResponse getTransferSettings(long userId) {
		validateActiveUser(userId);
		return TransferSettingsResponse.from(findSettings(userId));
	}

	@Transactional(readOnly = true)
	public NotificationSettingsResponse getNotificationSettings(long userId) {
		validateActiveUser(userId);
		return NotificationSettingsResponse.from(findSettings(userId));
	}

	@Transactional(readOnly = true)
	public CoachPersonaResponse getCoachPersona(long userId) {
		validateActiveUser(userId);
		return CoachPersonaResponse.from(findSettings(userId));
	}

	@Transactional
	public TransferSettingsResponse updateTransferSettings(
			long userId,
			TransferSettingsUpdateRequest request
	) {
		validateActiveUser(userId);
		UserSettings settings = findSettings(userId);
		settings.updateTransferSettings(
				request.transferConsent(),
				request.transferLimitOnce(),
				request.transferLimitDaily()
		);
		return TransferSettingsResponse.from(settings);
	}

	@Transactional
	public void updateNotificationSettings(long userId, NotificationSettingsUpdateRequest request) {
		validateActiveUser(userId);
		UserSettings settings = findSettings(userId);
		settings.updateNotificationSettings(
				request.notiCoaching(),
				request.notiBudgetAlert(),
				request.notiTransfer(),
				request.notiCleanup(),
				request.quietHoursStart(),
				request.quietHoursEnd()
		);
	}

	@Transactional
	public void updateCoachPersona(long userId, CoachPersonaUpdateRequest request) {
		validateActiveUser(userId);
		findSettings(userId).updateCoachPersona(request.coachPersona());
	}

	private UserSettings findSettings(long userId) {
		return userSettingsRepository.findById(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_SETTINGS_NOT_FOUND));
	}

	private void validateActiveUser(long userId) {
		userRepository.findByIdAndDeletedAtIsNull(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
	}
}
