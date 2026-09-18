package com.finset.key_fin.user.controller;

import com.finset.key_fin.global.base.BaseResponse;
import com.finset.key_fin.user.dto.request.CoachPersonaUpdateRequest;
import com.finset.key_fin.user.dto.request.NotificationSettingsUpdateRequest;
import com.finset.key_fin.user.dto.request.TransferSettingsUpdateRequest;
import com.finset.key_fin.user.dto.response.TransferSettingsResponse;
import com.finset.key_fin.user.service.UserSettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
public class UserSettingsController implements UserSettingsControllerDocs {

	private final UserSettingsService userSettingsService;

	@GetMapping(value = "/transfer", produces = APPLICATION_JSON_VALUE)
	@Override
	public BaseResponse<TransferSettingsResponse> getTransferSettings(
			@AuthenticationPrincipal Long userId
	) {
		return BaseResponse.ok(userSettingsService.getTransferSettings(userId));
	}

	@PutMapping(value = "/transfer", consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	@Override
	public BaseResponse<TransferSettingsResponse> updateTransferSettings(
			@AuthenticationPrincipal Long userId,
			@Valid @RequestBody TransferSettingsUpdateRequest request
	) {
		return BaseResponse.ok(userSettingsService.updateTransferSettings(userId, request));
	}

	@PutMapping(value = "/notifications", consumes = APPLICATION_JSON_VALUE)
	@Override
	public ResponseEntity<Void> updateNotificationSettings(
			@AuthenticationPrincipal Long userId,
			@Valid @RequestBody NotificationSettingsUpdateRequest request
	) {
		userSettingsService.updateNotificationSettings(userId, request);
		return ResponseEntity.ok().build();
	}

	@PutMapping(value = "/coach", consumes = APPLICATION_JSON_VALUE)
	@Override
	public ResponseEntity<Void> updateCoachPersona(
			@AuthenticationPrincipal Long userId,
			@Valid @RequestBody CoachPersonaUpdateRequest request
	) {
		userSettingsService.updateCoachPersona(userId, request);
		return ResponseEntity.ok().build();
	}
}
