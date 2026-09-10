package com.finset.key_fin.link.service;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.link.client.FinanceMemberClient;
import com.finset.key_fin.link.dto.request.FinanceLinkRequest;
import com.finset.key_fin.link.dto.response.FinanceLinkResponse;
import com.finset.key_fin.link.dto.response.FinanceMember;
import com.finset.key_fin.user.entity.User;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FinanceLinkService {

	private final UserRepository userRepository;
	private final FinanceMemberClient financeMemberClient;
	private final FinanceLinkWriter financeLinkWriter;

	public FinanceLinkResponse connect(long userId, FinanceLinkRequest request) {
		findActiveUser(userId);

		FinanceMember financeMember = financeMemberClient.findByEmail(request.financeEmail());
		return financeLinkWriter.connect(userId, financeMember.userKey());
	}

	@Transactional(readOnly = true)
	public FinanceLinkResponse getStatus(long userId) {
		User user = findActiveUser(userId);
		return FinanceLinkResponse.of(user.isFinanceConnected());
	}

	private User findActiveUser(long userId) {
		return userRepository.findByIdAndDeletedAtIsNull(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
	}
}
