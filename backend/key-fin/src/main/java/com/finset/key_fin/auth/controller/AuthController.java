package com.finset.key_fin.auth.controller;

import com.finset.key_fin.auth.dto.request.LoginRequest;
import com.finset.key_fin.auth.dto.request.RefreshTokenRequest;
import com.finset.key_fin.auth.dto.response.AccessTokenResponse;
import com.finset.key_fin.auth.dto.response.LoginResponse;
import com.finset.key_fin.auth.service.AuthService;
import com.finset.key_fin.global.base.BaseResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController implements AuthControllerDocs {

	private final AuthService authService;

	@PostMapping("/login")
	@Override
	public BaseResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
		return BaseResponse.ok(authService.login(request));
	}

	@PostMapping("/refresh")
	@Override
	public BaseResponse<AccessTokenResponse> refresh(
			@Valid @RequestBody RefreshTokenRequest request
	) {
		return BaseResponse.ok(authService.refresh(request));
	}
}
