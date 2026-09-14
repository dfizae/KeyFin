package com.finset.key_fin.user.service;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.user.dto.request.TransferSettingsUpdateRequest;
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
public class TransferSettingsService {

	private final UserRepository userRepository;
	private final UserSettingsRepository userSettingsRepository;

	@Transactional(readOnly = true)
	public TransferSettingsResponse getTransferSettings(long userId) {
		validateActiveUser(userId);
		return TransferSettingsResponse.from(findSettings(userId));
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

	private UserSettings findSettings(long userId) {
		return userSettingsRepository.findById(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_SETTINGS_NOT_FOUND));
	}

	private void validateActiveUser(long userId) {
		userRepository.findByIdAndDeletedAtIsNull(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
	}
}
