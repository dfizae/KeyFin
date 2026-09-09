package com.finset.key_fin.auth.service;

import com.finset.key_fin.auth.dto.request.LoginRequest;
import com.finset.key_fin.auth.dto.request.RefreshTokenRequest;
import com.finset.key_fin.auth.dto.response.AccessTokenResponse;
import com.finset.key_fin.auth.dto.response.LoginResponse;
import com.finset.key_fin.auth.exception.AuthErrorCode;
import com.finset.key_fin.auth.jwt.JwtTokenProvider;
import com.finset.key_fin.auth.jwt.TokenType;
import com.finset.key_fin.auth.repository.RefreshTokenRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.user.entity.User;
import com.finset.key_fin.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtTokenProvider jwtTokenProvider;
	private final RefreshTokenRepository refreshTokenRepository;

	public LoginResponse login(LoginRequest request) {
		User user = userRepository.findByEmailAndDeletedAtIsNull(request.email())
				.orElseThrow(() -> new BusinessException(AuthErrorCode.INVALID_CREDENTIALS));

		if (!passwordEncoder.matches(request.password(), user.getPassword())) {
			throw new BusinessException(AuthErrorCode.INVALID_CREDENTIALS);
		}

		String accessToken = jwtTokenProvider.generateAccessToken(user.getId());
		String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId());
		refreshTokenRepository.save(user.getId(), refreshToken);

		return new LoginResponse(
				accessToken,
				refreshToken,
				new LoginResponse.UserSummary(user.getId(), user.getName())
		);
	}

	public AccessTokenResponse refresh(RefreshTokenRequest request) {
		String refreshToken = request.refreshToken();
		long userId = getRefreshTokenUserId(refreshToken);

		if (!refreshTokenRepository.matches(userId, refreshToken)) {
			throw new BusinessException(AuthErrorCode.INVALID_REFRESH_TOKEN);
		}

		userRepository.findByIdAndDeletedAtIsNull(userId)
				.orElseThrow(() -> new BusinessException(AuthErrorCode.INVALID_REFRESH_TOKEN));

		return new AccessTokenResponse(jwtTokenProvider.generateAccessToken(userId));
	}

	private long getRefreshTokenUserId(String refreshToken) {
		try {
			return jwtTokenProvider.getUserId(refreshToken, TokenType.REFRESH);
		} catch (BusinessException exception) {
			throw new BusinessException(AuthErrorCode.INVALID_REFRESH_TOKEN, exception);
		}
	}
}
