package com.finset.key_fin.link.service;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.global.exception.ErrorCode;
import com.finset.key_fin.link.client.FinanceAccountClient;
import com.finset.key_fin.link.client.FinanceCardClient;
import com.finset.key_fin.link.dto.request.LinkAssetsRequest;
import com.finset.key_fin.link.dto.response.FinanceAccount;
import com.finset.key_fin.link.dto.response.FinanceCard;
import com.finset.key_fin.link.dto.response.LinkAssetsResponse;
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

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class LinkAssetServiceTest {

	private static final long USER_ID = 1L;
	private static final String FIN_USER_KEY = "finance-user-key";
	private static final FinanceAccount KB_ACCOUNT =
			new FinanceAccount("004", "국민은행", "0041456503815897", "국민 수시입출금", "1", 3_000_000L, "KRW");
	private static final FinanceAccount DEPOSIT_ACCOUNT =
			new FinanceAccount("020", "우리은행", "0204667768182760", "우리 정기예금", "2", 8_003_477L, "KRW");
	private static final FinanceCard SHINHAN_CARD = new FinanceCard(
			"1005872701650761", "725", "1005-x", "1005", "신한카드", "신한 딥디저트 카드",
			"20310910", "0880680068408149", "1"
	);

	@Mock
	private UserRepository userRepository;

	@Mock
	private FinanceAccountClient financeAccountClient;

	@Mock
	private FinanceCardClient financeCardClient;

	@Mock
	private LinkAssetWriter linkAssetWriter;

	@InjectMocks
	private LinkAssetService linkAssetService;

	private User user;

	@BeforeEach
	void setUp() {
		user = User.create("qwer@qwer.com", "encoded-password", "김예린");
		ReflectionTestUtils.setField(user, "id", USER_ID);
	}

	@Test
	void 후보_목록에_있는_계좌와_카드만_골라_저장에_위임한다() {
		user.connectFinance(FIN_USER_KEY);
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(financeAccountClient.findAccounts(FIN_USER_KEY)).willReturn(List.of(KB_ACCOUNT, DEPOSIT_ACCOUNT));
		given(financeCardClient.findCards(FIN_USER_KEY)).willReturn(List.of(SHINHAN_CARD));
		given(linkAssetWriter.link(USER_ID, List.of(KB_ACCOUNT), List.of(SHINHAN_CARD)))
				.willReturn(new LinkAssetsResponse(1, 1));

		LinkAssetsResponse response = linkAssetService.link(
				USER_ID,
				new LinkAssetsRequest(List.of("0041456503815897", "0041456503815897"), List.of("1005872701650761"))
		);

		assertThat(response.accounts()).isEqualTo(1);
		assertThat(response.cards()).isEqualTo(1);
		verify(linkAssetWriter).link(USER_ID, List.of(KB_ACCOUNT), List.of(SHINHAN_CARD));
	}

	@Test
	void 카드만_선택하면_계좌_목록은_조회하지_않는다() {
		user.connectFinance(FIN_USER_KEY);
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(financeCardClient.findCards(FIN_USER_KEY)).willReturn(List.of(SHINHAN_CARD));
		given(linkAssetWriter.link(USER_ID, List.of(), List.of(SHINHAN_CARD)))
				.willReturn(new LinkAssetsResponse(0, 1));

		linkAssetService.link(USER_ID, new LinkAssetsRequest(null, List.of("1005872701650761")));

		verifyNoInteractions(financeAccountClient);
	}

	@Test
	void 후보_목록에_없는_계좌는_거절한다() {
		user.connectFinance(FIN_USER_KEY);
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(financeAccountClient.findAccounts(FIN_USER_KEY)).willReturn(List.of(KB_ACCOUNT));

		assertBusinessError(
				LinkErrorCode.FINANCE_ASSET_NOT_FOUND,
				() -> linkAssetService.link(USER_ID, new LinkAssetsRequest(List.of("9999999999999999"), List.of()))
		);
		verifyNoInteractions(linkAssetWriter);
	}

	@Test
	void 수시입출금이_아닌_계좌는_후보에_없는_것으로_거절한다() {
		user.connectFinance(FIN_USER_KEY);
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(financeAccountClient.findAccounts(FIN_USER_KEY)).willReturn(List.of(KB_ACCOUNT, DEPOSIT_ACCOUNT));

		assertBusinessError(
				LinkErrorCode.FINANCE_ASSET_NOT_FOUND,
				() -> linkAssetService.link(USER_ID, new LinkAssetsRequest(List.of("0204667768182760"), List.of()))
		);
		verifyNoInteractions(linkAssetWriter);
	}

	@Test
	void 선택_항목이_없으면_거절한다() {
		assertBusinessError(
				LinkErrorCode.EMPTY_LINK_REQUEST,
				() -> linkAssetService.link(USER_ID, new LinkAssetsRequest(List.of(), null))
		);
		verifyNoInteractions(userRepository, financeAccountClient, financeCardClient, linkAssetWriter);
	}

	@Test
	void 금융망_미연결_사용자는_금융망을_호출하지_않고_거절한다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));

		assertBusinessError(
				LinkErrorCode.FINANCE_NOT_CONNECTED,
				() -> linkAssetService.link(USER_ID, new LinkAssetsRequest(List.of("0041456503815897"), List.of()))
		);
		verifyNoInteractions(financeAccountClient, financeCardClient, linkAssetWriter);
	}

	@Test
	void 계좌_연결_해제는_활성_사용자_확인_후_위임한다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));

		linkAssetService.unlinkAccount(USER_ID, 10L);

		verify(linkAssetWriter).unlinkAccount(USER_ID, 10L);
	}

	@Test
	void 탈퇴한_사용자는_카드_연결을_해제할_수_없다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.empty());

		assertBusinessError(UserErrorCode.USER_NOT_FOUND, () -> linkAssetService.unlinkCard(USER_ID, 20L));
		verifyNoInteractions(linkAssetWriter);
	}

	private void assertBusinessError(ErrorCode expectedErrorCode, Runnable action) {
		assertThatThrownBy(action::run)
				.isInstanceOf(BusinessException.class)
				.extracting(exception -> ((BusinessException) exception).getErrorCode())
				.isEqualTo(expectedErrorCode);
	}
}
