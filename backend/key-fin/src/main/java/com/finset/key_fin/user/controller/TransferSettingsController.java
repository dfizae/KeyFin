package com.finset.key_fin.user.controller;

import com.finset.key_fin.global.base.BaseResponse;
import com.finset.key_fin.user.dto.request.TransferSettingsUpdateRequest;
import com.finset.key_fin.user.dto.response.TransferSettingsResponse;
import com.finset.key_fin.user.service.TransferSettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@RestController
@RequestMapping("/api/v1/settings/transfer")
@RequiredArgsConstructor
public class TransferSettingsController implements TransferSettingsControllerDocs {

	private final TransferSettingsService transferSettingsService;

	@GetMapping(produces = APPLICATION_JSON_VALUE)
	@Override
	public BaseResponse<TransferSettingsResponse> getTransferSettings(
			@AuthenticationPrincipal Long userId
	) {
		return BaseResponse.ok(transferSettingsService.getTransferSettings(userId));
	}

	@PutMapping(consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	@Override
	public BaseResponse<TransferSettingsResponse> updateTransferSettings(
			@AuthenticationPrincipal Long userId,
			@Valid @RequestBody TransferSettingsUpdateRequest request
	) {
		return BaseResponse.ok(transferSettingsService.updateTransferSettings(userId, request));
	}
}
