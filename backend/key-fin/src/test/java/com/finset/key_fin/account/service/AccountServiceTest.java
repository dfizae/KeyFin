package com.finset.key_fin.account.service;

import com.finset.key_fin.account.dto.response.AccountListResponse;
import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.global.exception.BusinessException;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class AccountServiceTest {

	private static final long USER_ID = 1L;

	@Mock
	private UserRepository userRepository;

	@Mock
	private AccountRepository accountRepository;

	@InjectMocks
	private AccountService accountService;

	private User user;

	@BeforeEach
	void setUp() {
		user = User.create("qwer@qwer.com", "encoded-password", "김예린");
		ReflectionTestUtils.setField(user, "id", USER_ID);
	}

	@Test
	void 관리_중인_계좌를_ID_오름차순으로_조회한다() {
		LocalDateTime updatedAt = LocalDateTime.of(2026, 9, 11, 14, 30);
		Account account = Account.sync(
				user, "0010011073486799", "001", "한국은행", 1_500_000L, updatedAt);
		ReflectionTestUtils.setField(account, "id", 3L);
		ReflectionTestUtils.setField(account, "alias", "생활비");
		account.link();
		ReflectionTestUtils.setField(account, "income", true);
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(accountRepository.findAllByUserIdAndManagedTrueOrderByIdAsc(USER_ID))
				.willReturn(List.of(account));

		AccountListResponse response = accountService.getManagedAccounts(USER_ID);

		assertThat(response.items()).hasSize(1);
		assertThat(response.items().getFirst())
				.extracting("id", "finAccountNo", "bankName", "alias", "income", "managed", "balance", "balanceUpdatedAt")
				.containsExactly(3L, "0010011073486799", "한국은행", "생활비", true, true, 1_500_000L, updatedAt);
	}

	@Test
	void 관리_중인_계좌가_없으면_빈_목록을_반환한다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.of(user));
		given(accountRepository.findAllByUserIdAndManagedTrueOrderByIdAsc(USER_ID)).willReturn(List.of());

		AccountListResponse response = accountService.getManagedAccounts(USER_ID);

		assertThat(response.items()).isEmpty();
	}

	@Test
	void 탈퇴했거나_없는_사용자는_계좌를_조회할_수_없다() {
		given(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).willReturn(Optional.empty());

		assertThatThrownBy(() -> accountService.getManagedAccounts(USER_ID))
				.isInstanceOfSatisfying(BusinessException.class,
						exception -> assertThat(exception.getErrorCode()).isEqualTo(UserErrorCode.USER_NOT_FOUND));
		verifyNoInteractions(accountRepository);
	}
}
