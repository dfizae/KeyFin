package com.finset.key_fin.account.service;

import com.finset.key_fin.account.dto.response.AccountListResponse;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AccountService {

	private final UserRepository userRepository;
	private final AccountRepository accountRepository;

	@Transactional(readOnly = true)
	public AccountListResponse getManagedAccounts(long userId) {
		userRepository.findByIdAndDeletedAtIsNull(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));

		return AccountListResponse.from(
				accountRepository.findAllByUserIdAndManagedTrueOrderByIdAsc(userId)
		);
	}
}
