package com.finset.key_fin.payment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.jdbc.SqlConfig;
import org.springframework.transaction.annotation.Transactional;

import com.finset.key_fin.payment.client.FinanceSubscriptionClient;
import com.finset.key_fin.payment.dto.response.FinanceSubscription;
import com.finset.key_fin.payment.entity.FixedExpense;
import com.finset.key_fin.payment.repository.FixedExpenseRepository;
import com.finset.key_fin.payment.service.SubscriptionSyncService.SyncResult;
import com.finset.key_fin.support.SpringIntegrationTestSupport;

@Transactional
@Sql(scripts = "/sql/subscription-sync-fixture.sql", config = @SqlConfig(encoding = "UTF-8"))
class SubscriptionSyncServiceTest extends SpringIntegrationTestSupport {

	private static final long CONNECTED_USER = 986L;
	private static final long UNLINKED_USER = 985L;
	private static final String USER_KEY = "test-user-key-986";

	@Autowired
	private SubscriptionSyncService subscriptionSyncService;

	@Autowired
	private FixedExpenseRepository fixedExpenseRepository;


	@Test
	@DisplayName("금융망 목록을 기준으로 생성·갱신·되살림·비활성화하고 수동 항목은 건드리지 않는다")
	void syncsAgainstFinanceList() {
		when(financeSubscriptionClient.findSubscriptions(USER_KEY)).thenReturn(List.of(
				monthly("SUB-FLO", "FLO 개인", "9900", "20261015", "ACTIVE"),
				monthly("SUB-MELON", "멜론", "10900", "20261020", "ACTIVE"),
				monthly("SUB-NETFLIX", "넷플릭스", "13500", "20261001", "ACTIVE"),
				new FinanceSubscription("SUB-DAILY", "일간뉴스", "300", "DAILY", "300", "20260914", "ACTIVE")));

		SyncResult result = subscriptionSyncService.sync(CONNECTED_USER);

		assertThat(result).isEqualTo(new SyncResult(true, 1, 2, 1, 1));
		Map<String, FixedExpense> byId = synced();
		assertThat(byId.get("SUB-FLO").getName()).isEqualTo("FLO 개인");
		assertThat(byId.get("SUB-FLO").getAmount()).isEqualTo(9900L);
		assertThat(byId.get("SUB-FLO").getPaymentDay()).isEqualTo(15);
		assertThat(byId.get("SUB-MELON").isActive()).isTrue();
		assertThat(byId.get("SUB-WATCHA").isActive()).isFalse();
		assertThat(byId.get("SUB-NETFLIX").isActive()).isTrue();
		assertThat(byId.get("SUB-NETFLIX").getWithdrawalAccountId()).isNull();
		assertThat(byId.get("SUB-NETFLIX").getPaymentDay()).isEqualTo(1);
		assertThat(byId).doesNotContainKey("SUB-DAILY");

		FixedExpense rent = fixedExpenseRepository.findById(9704L).orElseThrow();
		assertThat(rent.isActive()).isTrue();
		assertThat(rent.getAmount()).isEqualTo(550000L);
	}

	@Test
	@DisplayName("금융망에서 PAUSED/CANCELED가 된 구독은 비활성화된다")
	void deactivatesPausedOrCanceled() {
		when(financeSubscriptionClient.findSubscriptions(USER_KEY)).thenReturn(List.of(
				monthly("SUB-FLO", "FLO", "8900", "20261013", "PAUSED"),
				monthly("SUB-WATCHA", "왓챠", "7900", "20261005", "CANCELED")));

		SyncResult result = subscriptionSyncService.sync(CONNECTED_USER);

		assertThat(result.deactivated()).isEqualTo(2);
		assertThat(result.created()).isZero();
		assertThat(synced().get("SUB-FLO").isActive()).isFalse();
		assertThat(synced().get("SUB-WATCHA").isActive()).isFalse();
	}

	@Test
	@DisplayName("같은 목록으로 두 번 동기화해도 행이 늘지 않는다")
	void reRunDoesNotDuplicate() {
		when(financeSubscriptionClient.findSubscriptions(USER_KEY)).thenReturn(List.of(
				monthly("SUB-NETFLIX", "넷플릭스", "13500", "20261001", "ACTIVE")));

		subscriptionSyncService.sync(CONNECTED_USER);
		SyncResult second = subscriptionSyncService.sync(CONNECTED_USER);

		assertThat(second.created()).isZero();
		assertThat(second.updated()).isEqualTo(1);
		assertThat(fixedExpenseRepository.findAllByUserIdAndFinSubscriptionIdIsNotNull(CONNECTED_USER))
				.filteredOn(row -> "SUB-NETFLIX".equals(row.getFinSubscriptionId()))
				.hasSize(1);
	}

	@Test
	@DisplayName("금융망 미연결 사용자는 호출 없이 건너뛴다")
	void skipsUserWithoutFinanceKey() {
		SyncResult result = subscriptionSyncService.sync(UNLINKED_USER);

		assertThat(result.connected()).isFalse();
		verify(financeSubscriptionClient, never()).findSubscriptions(ArgumentMatchers.anyString());
	}

	private Map<String, FixedExpense> synced() {
		return fixedExpenseRepository.findAllByUserIdAndFinSubscriptionIdIsNotNull(CONNECTED_USER).stream()
				.collect(Collectors.toMap(FixedExpense::getFinSubscriptionId, Function.identity()));
	}

	private static FinanceSubscription monthly(String id, String name, String amount, String nextPaymentDate, String status) {
		return new FinanceSubscription(id, name, amount, "MONTHLY", null, nextPaymentDate, status);
	}
}
