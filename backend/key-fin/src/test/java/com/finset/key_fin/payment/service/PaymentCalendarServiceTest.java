package com.finset.key_fin.payment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.jdbc.SqlConfig;
import org.springframework.transaction.annotation.Transactional;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.global.finance.exception.FinanceErrorCode;
import com.finset.key_fin.payment.client.FinanceSubscriptionClient;
import com.finset.key_fin.payment.dto.response.FinanceSubscription;
import com.finset.key_fin.payment.dto.response.PaymentCalendarResponse;
import com.finset.key_fin.payment.dto.response.PaymentCalendarResponse.CalendarItemType;
import com.finset.key_fin.payment.dto.response.PaymentCalendarResponse.Day;
import com.finset.key_fin.payment.dto.response.PaymentCalendarResponse.Item;

@SpringBootTest
@Transactional
@Sql(scripts = "/sql/subscription-sync-fixture.sql", config = @SqlConfig(encoding = "UTF-8"))
class PaymentCalendarServiceTest {

	private static final long USER = 986L;
	private static final String USER_KEY = "test-user-key-986";

	@Autowired
	private PaymentCalendarService paymentCalendarService;

	@MockitoBean
	private FinanceSubscriptionClient financeSubscriptionClient;

	@Test
	@DisplayName("동기화 후 활성 항목을 날짜별로 묶는다 — 수동은 FIXED, 동기화는 CARD_SUBSCRIPTION, 삭제 항목 제외, 31일은 말일 보정")
	void buildsCalendarForMonth() {
		when(financeSubscriptionClient.findSubscriptions(USER_KEY)).thenReturn(List.of(
				new FinanceSubscription("SUB-FLO", "FLO", "8900", "MONTHLY", null, "20261013", "ACTIVE"),
				new FinanceSubscription("SUB-NETFLIX", "넷플릭스", "13500", "MONTHLY", null, "20261015", "ACTIVE")));

		PaymentCalendarResponse response = paymentCalendarService.getCalendar(USER, YearMonth.of(2026, 9));

		assertThat(response.month()).isEqualTo("202609");
		assertThat(response.days()).extracting(Day::date).containsExactly(
				LocalDate.of(2026, 9, 13), LocalDate.of(2026, 9, 15), LocalDate.of(2026, 9, 30));

		Day fifteenth = response.days().get(1);
		assertThat(fifteenth.items()).extracting(Item::name).containsExactly("월세", "넷플릭스");
		assertThat(fifteenth.items().get(0).type()).isEqualTo(CalendarItemType.FIXED);
		assertThat(fifteenth.items().get(0).withdrawalAccountId()).isEqualTo(9504L);
		assertThat(fifteenth.items().get(0).prepared()).isNull();
		assertThat(fifteenth.items().get(1).type()).isEqualTo(CalendarItemType.CARD_SUBSCRIPTION);
		assertThat(fifteenth.items().get(1).withdrawalAccountId()).isNull();

		Item telecom = response.days().get(2).items().get(0);
		assertThat(telecom.name()).isEqualTo("통신비");
		assertThat(telecom.estimated()).isTrue();

		assertThat(response.days()).flatExtracting(Day::items).extracting(Item::name)
				.doesNotContain("왓챠", "헬스장", "멜론");
	}

	@Test
	@DisplayName("금융망 동기화가 실패해도 저장된 항목으로 캘린더를 돌려준다")
	void fallsBackToStoredRowsWhenSyncFails() {
		when(financeSubscriptionClient.findSubscriptions(USER_KEY))
				.thenThrow(new BusinessException(FinanceErrorCode.USER_KEY_INVALID));

		PaymentCalendarResponse response = paymentCalendarService.getCalendar(USER, YearMonth.of(2026, 10));

		assertThat(response.days()).flatExtracting(Day::items).extracting(Item::name)
				.containsExactly("왓챠", "FLO", "월세", "통신비");
		assertThat(response.days()).extracting(Day::date).containsExactly(
				LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 13), LocalDate.of(2026, 10, 15), LocalDate.of(2026, 10, 31));
	}

	@Test
	@DisplayName("항목이 없는 달은 빈 days")
	void emptyMonthWhenNothingActive() {
		when(financeSubscriptionClient.findSubscriptions(USER_KEY)).thenReturn(List.of());

		PaymentCalendarResponse response = paymentCalendarService.getCalendar(985L, YearMonth.of(2026, 9));

		assertThat(response.days()).isEmpty();
	}
}
