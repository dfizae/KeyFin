package com.finset.key_fin.transaction.service;

import com.finset.key_fin.transaction.entity.TransactionAssetType;
import com.finset.key_fin.transaction.entity.TransactionPollingState;
import com.finset.key_fin.transaction.repository.TransactionPollingStateRepository;
import com.finset.key_fin.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class TransactionPollingStateServiceTest {

	private static final long USER_ID = 1L;
	private static final long ACCOUNT_ID = 3L;
	private static final LocalDate TODAY = LocalDate.of(2026, 9, 15);

	@Mock
	private TransactionPollingStateRepository pollingStateRepository;

	private TransactionPollingStateService pollingStateService;
	private User user;

	@BeforeEach
	void setUp() {
		pollingStateService = new TransactionPollingStateService(pollingStateRepository);
		user = User.create("qwer@qwer.com", "password", "김예린");
		ReflectionTestUtils.setField(user, "id", USER_ID);
	}

	@Test
	void 최초_폴링은_어제부터_오늘까지_조회한다() {
		given(pollingStateRepository.findByUserIdAndAssetTypeAndAssetId(
				USER_ID, TransactionAssetType.ACCOUNT, ACCOUNT_ID))
				.willReturn(Optional.empty());

		LocalDate startDate = pollingStateService.calculatePollingStartDate(
				USER_ID, TransactionAssetType.ACCOUNT, ACCOUNT_ID, TODAY);

		assertThat(startDate).isEqualTo(TODAY.minusDays(1));
	}

	@Test
	void 기존_폴링은_마지막_성공일의_하루_전부터_오늘까지_조회한다() {
		TransactionPollingState state = TransactionPollingState.create(
				user, TransactionAssetType.ACCOUNT, ACCOUNT_ID);
		state.recordPollingSuccess(LocalDateTime.of(2026, 9, 14, 10, 30));
		given(pollingStateRepository.findByUserIdAndAssetTypeAndAssetId(
				USER_ID, TransactionAssetType.ACCOUNT, ACCOUNT_ID))
				.willReturn(Optional.of(state));

		LocalDate startDate = pollingStateService.calculatePollingStartDate(
				USER_ID, TransactionAssetType.ACCOUNT, ACCOUNT_ID, TODAY);

		assertThat(startDate).isEqualTo(LocalDate.of(2026, 9, 13));
	}

	@Test
	void 상태가_없으면_성공_상태를_새로_저장한다() {
		LocalDateTime syncedAt = LocalDateTime.of(2026, 9, 15, 10, 30);
		given(pollingStateRepository.findByUserIdAndAssetTypeAndAssetId(
				USER_ID, TransactionAssetType.ACCOUNT, ACCOUNT_ID))
				.willReturn(Optional.empty());

		pollingStateService.recordPollingSuccess(
				user, TransactionAssetType.ACCOUNT, ACCOUNT_ID, syncedAt);

		ArgumentCaptor<TransactionPollingState> captor = ArgumentCaptor.forClass(TransactionPollingState.class);
		verify(pollingStateRepository).save(captor.capture());
		assertThat(captor.getValue().getUser()).isSameAs(user);
		assertThat(captor.getValue().getAssetType()).isEqualTo(TransactionAssetType.ACCOUNT);
		assertThat(captor.getValue().getAssetId()).isEqualTo(ACCOUNT_ID);
		assertThat(captor.getValue().getLastPolledAt()).isEqualTo(syncedAt);
	}

	@Test
	void 기존_상태가_있으면_마지막_성공_시각을_변경한다() {
		TransactionPollingState state = TransactionPollingState.create(
				user, TransactionAssetType.ACCOUNT, ACCOUNT_ID);
		LocalDateTime syncedAt = LocalDateTime.of(2026, 9, 15, 10, 30);
		given(pollingStateRepository.findByUserIdAndAssetTypeAndAssetId(
				USER_ID, TransactionAssetType.ACCOUNT, ACCOUNT_ID))
				.willReturn(Optional.of(state));

		pollingStateService.recordPollingSuccess(
				user, TransactionAssetType.ACCOUNT, ACCOUNT_ID, syncedAt);

		assertThat(state.getLastPolledAt()).isEqualTo(syncedAt);
		verify(pollingStateRepository).save(state);
	}
}
