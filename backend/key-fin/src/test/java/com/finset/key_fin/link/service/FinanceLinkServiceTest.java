package com.finset.key_fin.link.service;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.global.exception.ErrorCode;
import com.finset.key_fin.link.client.FinanceMemberClient;
import com.finset.key_fin.link.dto.request.FinanceLinkRequest;
import com.finset.key_fin.link.dto.response.FinanceLinkResponse;
import com.finset.key_fin.link.dto.response.FinanceMember;
import com.finset.key_fin.user.entity.User;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class FinanceLinkServiceTest {

	private static final long USER_ID = 1L;
	private static final String KEYFIN_EMAIL = "qwer@qwer.com";
	private static final String FINANCE_EMAIL = "finance@qwer.com";
	private static final String FIN_USER_KEY = "finance-user-key";
	private static final FinanceLinkRequest REQUEST = new FinanceLinkRequest(FINANCE_EMAIL);

	@Mock
	private UserRepository userRepository;

	@Mock
	private FinanceMemberClient financeMemberClient;

	@Mock
	private FinanceLinkWriter financeLinkWriter;

	@InjectMocks
	private FinanceLinkService financeLinkService;

	private User user;

	@BeforeEach
	void setUp() {
		user = User.create(KEYFIN_EMAIL, "encoded-password", "김예린");
		ReflectionTestUtils.setField(user, "id", USER_ID);
	}

	@Test
	void 금융망_조회_후_짧은_저장_트랜잭션에_연결을_위임한다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(financeMemberClient.findByEmail(FINANCE_EMAIL))
				.willReturn(new FinanceMember(FINANCE_EMAIL, FIN_USER_KEY));
		given(financeLinkWriter.connect(USER_ID, FIN_USER_KEY))
				.willReturn(FinanceLinkResponse.of(true));

		FinanceLinkResponse response = financeLinkService.connect(USER_ID, REQUEST);

		assertThat(response.connected()).isTrue();
		verify(financeMemberClient).findByEmail(FINANCE_EMAIL);
		verify(financeLinkWriter).connect(USER_ID, FIN_USER_KEY);
	}

	@Test
	void 탈퇴했거나_존재하지_않는_사용자는_금융망을_호출하지_않는다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.empty());

		assertBusinessError(
				UserErrorCode.USER_NOT_FOUND,
				() -> financeLinkService.connect(USER_ID, REQUEST)
		);
		verifyNoInteractions(financeMemberClient, financeLinkWriter);
	}

	@Test
	void 금융망_연결_상태를_조회한다() {
		user.connectFinance(FIN_USER_KEY);
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));

		FinanceLinkResponse response = financeLinkService.getStatus(USER_ID);

		assertThat(response.connected()).isTrue();
		verifyNoInteractions(financeMemberClient, financeLinkWriter);
	}

	@Test
	void 금융망에_연결되지_않은_상태를_조회한다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));

		FinanceLinkResponse response = financeLinkService.getStatus(USER_ID);

		assertThat(response.connected()).isFalse();
		verifyNoInteractions(financeMemberClient, financeLinkWriter);
	}

	private void assertBusinessError(ErrorCode expectedErrorCode, Runnable action) {
		assertThatThrownBy(action::run)
				.isInstanceOf(BusinessException.class)
				.extracting(exception -> ((BusinessException) exception).getErrorCode())
				.isEqualTo(expectedErrorCode);
	}
}
