package com.finset.key_fin.link.service;

import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.card.entity.Card;
import com.finset.key_fin.card.repository.CardRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.global.exception.ErrorCode;
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
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class LinkAssetWriterTest {

	private static final long USER_ID = 1L;
	private static final FinanceAccount KB_ACCOUNT =
			new FinanceAccount("004", "국민은행", "0041456503815897", "국민 수시입출금", "1", 3_000_000L, "KRW");
	private static final FinanceAccount SHINHAN_ACCOUNT =
			new FinanceAccount("088", "신한은행", "0880680068408149", "신한 수시입출금", "1", 125_000L, "KRW");
	private static final FinanceCard SHINHAN_CARD = new FinanceCard(
			"1005872701650761", "725", "1005-x", "1005", "신한카드", "신한 딥디저트 카드",
			"20310910", "0880680068408149", "1"
	);

	@Mock
	private UserRepository userRepository;

	@Mock
	private AccountRepository accountRepository;

	@Mock
	private CardRepository cardRepository;

	@InjectMocks
	private LinkAssetWriter linkAssetWriter;

	private User user;

	@BeforeEach
	void setUp() {
		user = User.create("qwer@qwer.com", "encoded-password", "김예린");
		ReflectionTestUtils.setField(user, "id", USER_ID);
		user.connectFinance("finance-user-key");
	}

	@Test
	void 계좌를_먼저_저장하고_카드의_출금_계좌를_같은_요청의_계좌로_매칭한다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(accountRepository.findAllByUserId(USER_ID)).willReturn(List.of());
		given(cardRepository.findAllByUserId(USER_ID)).willReturn(List.of());
		given(accountRepository.save(any(Account.class))).willAnswer(invocation -> invocation.getArgument(0));

		LinkAssetsResponse response = linkAssetWriter.link(
				USER_ID, List.of(KB_ACCOUNT, SHINHAN_ACCOUNT), List.of(SHINHAN_CARD));

		assertThat(response.accounts()).isEqualTo(2);
		assertThat(response.cards()).isEqualTo(1);
		ArgumentCaptor<Card> cardCaptor = ArgumentCaptor.forClass(Card.class);
		verify(cardRepository).save(cardCaptor.capture());
		Card savedCard = cardCaptor.getValue();
		assertThat(savedCard.getFinCardNo()).isEqualTo("1005872701650761");
		assertThat(savedCard.getCvc()).isEqualTo("725");
		assertThat(savedCard.getIssuerCode()).isEqualTo("1005");
		assertThat(savedCard.getCardName()).isEqualTo("신한 딥디저트 카드");
		assertThat(savedCard.getWithdrawalAccount()).isNotNull();
		assertThat(savedCard.getWithdrawalAccount().getFinAccountNo()).isEqualTo("0880680068408149");
		assertThat(savedCard.isManaged()).isTrue();
	}

	@Test
	void 출금_계좌가_연결되지_않은_카드는_출금_계좌_없이_저장한다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(accountRepository.findAllByUserId(USER_ID)).willReturn(List.of());
		given(cardRepository.findAllByUserId(USER_ID)).willReturn(List.of());

		LinkAssetsResponse response = linkAssetWriter.link(USER_ID, List.of(), List.of(SHINHAN_CARD));

		assertThat(response.cards()).isEqualTo(1);
		ArgumentCaptor<Card> cardCaptor = ArgumentCaptor.forClass(Card.class);
		verify(cardRepository).save(cardCaptor.capture());
		assertThat(cardCaptor.getValue().getWithdrawalAccount()).isNull();
	}

	@Test
	void 이미_연결된_항목은_저장하지_않고_응답_수에서_제외한다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(accountRepository.findAllByUserId(USER_ID))
				.willReturn(List.of(Account.link(user, "0041456503815897", "004")));
		given(cardRepository.findAllByUserId(USER_ID))
				.willReturn(List.of(Card.link(user, "1005872701650761", "725", "1005", "신한 딥디저트 카드", null)));

		LinkAssetsResponse response = linkAssetWriter.link(USER_ID, List.of(KB_ACCOUNT), List.of(SHINHAN_CARD));

		assertThat(response.accounts()).isZero();
		assertThat(response.cards()).isZero();
		verify(accountRepository, never()).save(any());
		verify(cardRepository, never()).save(any());
	}

	@Test
	void 연결_해제된_항목을_다시_선택하면_관리_대상으로_되돌리고_응답_수에_포함한다() {
		Account unlinkedAccount = Account.link(user, "0041456503815897", "004");
		unlinkedAccount.unlink();
		Card unlinkedCard = Card.link(user, "1005872701650761", "725", "1005", "신한 딥디저트 카드", null);
		unlinkedCard.unlink();
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(accountRepository.findAllByUserId(USER_ID)).willReturn(List.of(unlinkedAccount));
		given(cardRepository.findAllByUserId(USER_ID)).willReturn(List.of(unlinkedCard));

		LinkAssetsResponse response = linkAssetWriter.link(USER_ID, List.of(KB_ACCOUNT), List.of(SHINHAN_CARD));

		assertThat(response.accounts()).isEqualTo(1);
		assertThat(response.cards()).isEqualTo(1);
		assertThat(unlinkedAccount.isManaged()).isTrue();
		assertThat(unlinkedCard.isManaged()).isTrue();
		verify(accountRepository, never()).save(any());
		verify(cardRepository, never()).save(any());
	}

	@Test
	void 계좌_연결을_해제하면_관리_대상과_수입_계좌_지정이_함께_풀린다() {
		Account account = Account.link(user, "0041456503815897", "004");
		ReflectionTestUtils.setField(account, "income", true);
		given(accountRepository.findByIdAndUserId(10L, USER_ID)).willReturn(Optional.of(account));

		linkAssetWriter.unlinkAccount(USER_ID, 10L);

		assertThat(account.isManaged()).isFalse();
		assertThat(account.isIncome()).isFalse();
	}

	@Test
	void 본인_계좌가_아니면_해제할_수_없다() {
		given(accountRepository.findByIdAndUserId(10L, USER_ID)).willReturn(Optional.empty());

		assertBusinessError(LinkErrorCode.ACCOUNT_NOT_FOUND, () -> linkAssetWriter.unlinkAccount(USER_ID, 10L));
	}

	@Test
	void 카드_연결을_해제하면_관리_대상에서_제외된다() {
		Card card = Card.link(user, "1005872701650761", "725", "1005", "신한 딥디저트 카드", null);
		given(cardRepository.findByIdAndUserId(20L, USER_ID)).willReturn(Optional.of(card));

		linkAssetWriter.unlinkCard(USER_ID, 20L);

		assertThat(card.isManaged()).isFalse();
	}

	@Test
	void 본인_카드가_아니면_해제할_수_없다() {
		given(cardRepository.findByIdAndUserId(20L, USER_ID)).willReturn(Optional.empty());

		assertBusinessError(LinkErrorCode.CARD_NOT_FOUND, () -> linkAssetWriter.unlinkCard(USER_ID, 20L));
	}

	@Test
	void 저장_시점에_사용자가_없으면_연결할_수_없다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.empty());

		assertBusinessError(
				UserErrorCode.USER_NOT_FOUND,
				() -> linkAssetWriter.link(USER_ID, List.of(KB_ACCOUNT), List.of())
		);
	}

	private void assertBusinessError(ErrorCode expectedErrorCode, Runnable action) {
		assertThatThrownBy(action::run)
				.isInstanceOf(BusinessException.class)
				.extracting(exception -> ((BusinessException) exception).getErrorCode())
				.isEqualTo(expectedErrorCode);
	}
}
