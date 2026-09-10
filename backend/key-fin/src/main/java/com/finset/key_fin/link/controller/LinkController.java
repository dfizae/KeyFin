package com.finset.key_fin.link.controller;

import com.finset.key_fin.global.base.BaseResponse;
import com.finset.key_fin.link.dto.request.FinanceLinkRequest;
import com.finset.key_fin.link.dto.response.FinanceLinkResponse;
import com.finset.key_fin.link.service.FinanceLinkService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/links")
@RequiredArgsConstructor
public class LinkController implements LinkControllerDocs {

	private final FinanceLinkService financeLinkService;

	@PostMapping("/connect")
	@Override
	public BaseResponse<FinanceLinkResponse> connect(
			@AuthenticationPrincipal Long userId,
			@Valid @RequestBody FinanceLinkRequest request
	) {
		return BaseResponse.ok(financeLinkService.connect(userId, request));
	}

	@GetMapping("/status")
	@Override
	public BaseResponse<FinanceLinkResponse> getStatus(
			@AuthenticationPrincipal Long userId
	) {
		return BaseResponse.ok(financeLinkService.getStatus(userId));
	}
}
