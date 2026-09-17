package com.finset.key_fin.user.service;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.user.dto.request.CoachPersonaUpdateRequest;
import com.finset.key_fin.user.entity.UserSettings;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import com.finset.key_fin.user.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CoachSettingsService {

	private final UserRepository userRepository;
	private final UserSettingsRepository userSettingsRepository;

	@Transactional
	public void updateCoachPersona(long userId, CoachPersonaUpdateRequest request) {
		userRepository.findByIdAndDeletedAtIsNull(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
		UserSettings settings = userSettingsRepository.findById(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_SETTINGS_NOT_FOUND));

		settings.updateCoachPersona(request.coachPersona());
	}
}
