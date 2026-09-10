package com.finset.key_fin.link.service;

import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.card.entity.Card;
import com.finset.key_fin.card.repository.CardRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.global.exception.ErrorCode;
import com.finset.key_fin.link.client.FinanceAccountClient;
import com.finset.key_fin.link.client.FinanceCardClient;
import com.finset.key_fin.link.dto.response.FinanceAccount;
import com.finset.key_fin.link.dto.response.FinanceCard;
import com.finset.key_fin.link.dto.response.LinkCandidatesResponse;
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
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class LinkCandidateServiceTest {

	private static final long USER_ID = 1L;
	private static final String FIN_USER_KEY = "finance-user-key";

	@Mock
	private UserRepository userRepository;

	@Mock
	private AccountRepository accountRepository;

	@Mock
	private CardRepository cardRepository;

	@Mock
	private FinanceAccountClient financeAccountClient;

	@Mock
	private FinanceCardClient financeCardClient;

	@InjectMocks
	private LinkCandidateService linkCandidateService;

	private User user;

	@BeforeEach
	void setUp() {
		user = User.create("qwer@qwer.com", "encoded-password", "김예린");
		ReflectionTestUtils.setField(user, "id", USER_ID);
	}

	@Test
	void 수시입출금_계좌와_카드_후보를_연결_여부와_함께_반환한다() {
		user.connectFinance(FIN_USER_KEY);
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(financeAccountClient.findAccounts(FIN_USER_KEY)).willReturn(List.of(
				new FinanceAccount("001", "한국은행", "0010011073486799", "한국은행 수시입출금", "1", 1_500_000L, "KRW"),
				new FinanceAccount("020", "우리은행", "0204667768182760", "우리은행 정기예금", "2", 8_003_477L, "KRW"),
				new FinanceAccount("032", "대구은행", "0323555042323510", "대구은행 수시입출금", "1", 200_000L, "KRW")
		));
		given(financeCardClient.findCards(FIN_USER_KEY)).willReturn(List.of(
				new FinanceCard("1003198565339181", "149", "1003-a", "1003", "롯데카드", "디지로카 SEOUL", "20290409", "0323555042323510", "4"),
				new FinanceCard("1005518816096479", "725", "1005-b", "1005", "신한카드", "신한 TRAVEL 카드", "20290403", "0323555042323510", "1")
		));
		Account linkedAccount = Account.link(user, "0323555042323510", "032");
		ReflectionTestUtils.setField(linkedAccount, "id", 3L);
		Card linkedCard = Card.link(user, "1003198565339181", "149", "1003", "디지로카 SEOUL", null);
		ReflectionTestUtils.setField(linkedCard, "id", 7L);
		Card unlinkedCard = Card.link(user, "1005518816096479", "725", "1005", "신한 TRAVEL 카드", null);
		ReflectionTestUtils.setField(unlinkedCard, "id", 8L);
		unlinkedCard.unlink();
		given(accountRepository.findAllByUserId(USER_ID)).willReturn(List.of(linkedAccount));
		given(cardRepository.findAllByUserId(USER_ID)).willReturn(List.of(linkedCard, unlinkedCard));

		LinkCandidatesResponse response = linkCandidateService.getCandidates(USER_ID);

		assertThat(response.accounts())
				.extracting(
						LinkCandidatesResponse.AccountCandidate::finAccountNo,
						LinkCandidatesResponse.AccountCandidate::linked,
						LinkCandidatesResponse.AccountCandidate::linkedId
				)
				.containsExactly(
						org.assertj.core.groups.Tuple.tuple("0010011073486799", false, null),
						org.assertj.core.groups.Tuple.tuple("0323555042323510", true, 3L)
				);
		assertThat(response.accounts().get(0).bankName()).isEqualTo("한국은행");
		assertThat(response.accounts().get(0).balance()).isEqualTo(1_500_000L);
		assertThat(response.cards())
				.extracting(
						LinkCandidatesResponse.CardCandidate::cardNo,
						LinkCandidatesResponse.CardCandidate::linked,
						LinkCandidatesResponse.CardCandidate::linkedId
				)
				.containsExactly(
						org.assertj.core.groups.Tuple.tuple("1003198565339181", true, 7L),
						org.assertj.core.groups.Tuple.tuple("1005518816096479", false, null)
				);
		assertThat(response.cards().get(1).issuerName()).isEqualTo("신한카드");
		assertThat(response.cards().get(1).withdrawalAccountNo()).isEqualTo("0323555042323510");
	}

	@Test
	void 금융망_계좌와_카드가_없으면_빈_목록을_반환한다() {
		user.connectFinance(FIN_USER_KEY);
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(financeAccountClient.findAccounts(FIN_USER_KEY)).willReturn(List.of());
		given(financeCardClient.findCards(FIN_USER_KEY)).willReturn(List.of());
		given(accountRepository.findAllByUserId(USER_ID)).willReturn(List.of());
		given(cardRepository.findAllByUserId(USER_ID)).willReturn(List.of());

		LinkCandidatesResponse response = linkCandidateService.getCandidates(USER_ID);

		assertThat(response.accounts()).isEmpty();
		assertThat(response.cards()).isEmpty();
	}

	@Test
	void 금융망에_연결되지_않은_사용자는_금융망을_호출하지_않고_거절한다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));

		assertBusinessError(
				LinkErrorCode.FINANCE_NOT_CONNECTED,
				() -> linkCandidateService.getCandidates(USER_ID)
		);
		verifyNoInteractions(financeAccountClient, financeCardClient, accountRepository, cardRepository);
	}

	@Test
	void 탈퇴했거나_존재하지_않는_사용자는_거절한다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.empty());

		assertBusinessError(
				UserErrorCode.USER_NOT_FOUND,
				() -> linkCandidateService.getCandidates(USER_ID)
		);
		verifyNoInteractions(financeAccountClient, financeCardClient);
	}

	private void assertBusinessError(ErrorCode expectedErrorCode, Runnable action) {
		assertThatThrownBy(action::run)
				.isInstanceOf(BusinessException.class)
				.extracting(exception -> ((BusinessException) exception).getErrorCode())
				.isEqualTo(expectedErrorCode);
	}
}
