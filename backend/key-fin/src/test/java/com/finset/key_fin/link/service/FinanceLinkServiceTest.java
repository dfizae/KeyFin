package com.finset.key_fin.link.service;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.global.exception.ErrorCode;
import com.finset.key_fin.link.client.FinanceMemberClient;
import com.finset.key_fin.link.dto.request.FinanceLinkRequest;
import com.finset.key_fin.link.dto.response.FinanceLinkResponse;
import com.finset.key_fin.link.dto.response.FinanceMember;
import com.finset.key_fin.link.exception.LinkErrorCode;
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

	@InjectMocks
	private FinanceLinkService financeLinkService;

	private User user;

	@BeforeEach
	void setUp() {
		user = User.create(KEYFIN_EMAIL, "encoded-password", "김예린");
		ReflectionTestUtils.setField(user, "id", USER_ID);
	}

	@Test
	void 로그인_사용자를_금융망_회원과_연결한다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(financeMemberClient.findByEmail(FINANCE_EMAIL))
				.willReturn(new FinanceMember(FINANCE_EMAIL, FIN_USER_KEY));
		given(userRepository.existsByFinUserKeyAndIdNot(FIN_USER_KEY, USER_ID)).willReturn(false);

		FinanceLinkResponse response = financeLinkService.connect(USER_ID, REQUEST);

		assertThat(response.connected()).isTrue();
		assertThat(user.getFinUserKey()).isEqualTo(FIN_USER_KEY);
		verify(financeMemberClient).findByEmail(FINANCE_EMAIL);
	}

	@Test
	void 같은_금융망_회원과의_재연결은_성공한다() {
		user.connectFinance(FIN_USER_KEY);
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(financeMemberClient.findByEmail(FINANCE_EMAIL))
				.willReturn(new FinanceMember(FINANCE_EMAIL, FIN_USER_KEY));
		given(userRepository.existsByFinUserKeyAndIdNot(FIN_USER_KEY, USER_ID)).willReturn(false);

		FinanceLinkResponse response = financeLinkService.connect(USER_ID, REQUEST);

		assertThat(response.connected()).isTrue();
		assertThat(user.getFinUserKey()).isEqualTo(FIN_USER_KEY);
	}

	@Test
	void 탈퇴했거나_존재하지_않는_사용자는_연결할_수_없다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.empty());

		assertBusinessError(
				UserErrorCode.USER_NOT_FOUND,
				() -> financeLinkService.connect(USER_ID, REQUEST)
		);
		verifyNoInteractions(financeMemberClient);
	}

	@Test
	void 다른_계정이_사용하는_금융망_회원은_연결할_수_없다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(financeMemberClient.findByEmail(FINANCE_EMAIL))
				.willReturn(new FinanceMember(FINANCE_EMAIL, FIN_USER_KEY));
		given(userRepository.existsByFinUserKeyAndIdNot(FIN_USER_KEY, USER_ID)).willReturn(true);

		assertBusinessError(
				LinkErrorCode.FINANCE_MEMBER_ALREADY_LINKED,
				() -> financeLinkService.connect(USER_ID, REQUEST)
		);
		assertThat(user.isFinanceConnected()).isFalse();
	}

	@Test
	void 이미_연결된_사용자를_다른_금융망_회원으로_변경할_수_없다() {
		user.connectFinance("existing-finance-user-key");
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(financeMemberClient.findByEmail(FINANCE_EMAIL))
				.willReturn(new FinanceMember(FINANCE_EMAIL, FIN_USER_KEY));
		given(userRepository.existsByFinUserKeyAndIdNot(FIN_USER_KEY, USER_ID)).willReturn(false);

		assertBusinessError(
				UserErrorCode.FINANCE_CONNECTION_CONFLICT,
				() -> financeLinkService.connect(USER_ID, REQUEST)
		);
		assertThat(user.getFinUserKey()).isEqualTo("existing-finance-user-key");
	}

	private void assertBusinessError(ErrorCode expectedErrorCode, Runnable action) {
		assertThatThrownBy(action::run)
				.isInstanceOf(BusinessException.class)
				.extracting(exception -> ((BusinessException) exception).getErrorCode())
				.isEqualTo(expectedErrorCode);
	}
}
