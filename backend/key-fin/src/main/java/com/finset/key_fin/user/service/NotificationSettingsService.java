package com.finset.key_fin.user.service;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.user.dto.request.NotificationSettingsUpdateRequest;
import com.finset.key_fin.user.entity.UserSettings;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import com.finset.key_fin.user.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationSettingsService {

	private final UserRepository userRepository;
	private final UserSettingsRepository userSettingsRepository;

	@Transactional
	public void updateNotificationSettings(long userId, NotificationSettingsUpdateRequest request) {
		userRepository.findByIdAndDeletedAtIsNull(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
		UserSettings settings = userSettingsRepository.findById(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_SETTINGS_NOT_FOUND));

		settings.updateNotificationSettings(
				request.notiCoaching(),
				request.notiBudgetAlert(),
				request.notiTransfer(),
				request.notiCleanup(),
				request.quietHoursStart(),
				request.quietHoursEnd()
		);
	}
}
