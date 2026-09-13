package com.finset.key_fin.fincoin.service;

import com.finset.key_fin.fincoin.dto.response.FinCoinResponse;
import com.finset.key_fin.fincoin.dto.response.FinCoinResponse.FinCoinHistoryResponse;
import com.finset.key_fin.fincoin.entity.FinCoinReason;
import com.finset.key_fin.fincoin.entity.FinCoin;
import com.finset.key_fin.fincoin.repository.FinCoinRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.support.SpringIntegrationTestSupport;
import com.finset.key_fin.user.exception.UserErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Limit;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

@Transactional
@Sql("/sql/fin-coin-history-fixture.sql")
class FinCoinServiceTest extends SpringIntegrationTestSupport {

	private static final long USER = 981L;

	@Autowired
	private FinCoinService finCoinService;

	@Autowired
	private FinCoinRepository finCoinRepository;

	@Autowired
	private JdbcClient jdbcClient;

	@Test
	void limitsDatabaseResultsBeforeResponseTrimming() {
		assertThat(finCoinRepository.findByUserIdOrderByIdDesc(USER, Limit.of(2)))
				.extracting(FinCoin::getId)
				.containsExactly(8_100_000_009L, 8_100_000_007L);
		assertThat(finCoinRepository.findByUserIdAndIdLessThanOrderByIdDesc(
				USER, 8_100_000_007L, Limit.of(2)))
				.extracting(FinCoin::getId)
				.containsExactly(8_100_000_005L, 8_100_000_003L);
	}

	@ParameterizedTest
	@CsvSource({"981, 700", "982, 2000"})
	void returnsLatestBalanceByUserAndIdAfterPurchase(long userId, int expectedBalance) {
		assertThat(finCoinService.getFinCoinBalance(userId).balance()).isEqualTo(expectedBalance);
	}

	@Test
	void returnsZeroBalanceForUserWithoutHistory() {
		assertThat(finCoinService.getFinCoinBalance(983L).balance()).isZero();
	}

	@Test
	void returnsZeroBalanceAfterSpendingAllCoins() {
		jdbcClient.sql("""
				INSERT INTO fin_coin (id, user_id, delta, balance_after, reason_code, grant_date)
				VALUES (8100000011, 981, -700, 0, 'PURCHASE', '2026-09-11')
				""").update();

		assertThat(finCoinService.getFinCoinBalance(USER).balance()).isZero();
	}

	@ParameterizedTest
	@ValueSource(longs = {984, 985})
	void rejectsBalanceRequestForDeletedOrMissingUser(long userId) {
		assertThatThrownBy(() -> finCoinService.getFinCoinBalance(userId))
				.isInstanceOfSatisfying(BusinessException.class,
						exception -> assertThat(exception.getErrorCode()).isEqualTo(UserErrorCode.USER_NOT_FOUND));
	}

	@Test
	void pagesByDescendingId() {
		FinCoinResponse first = finCoinService.getFinCoins(USER, null, 2);
		assertThat(first.items()).extracting(FinCoinHistoryResponse::id)
				.containsExactly(8_100_000_009L, 8_100_000_007L);
		assertThat(first.nextCursor()).isEqualTo(8_100_000_007L);

		FinCoinResponse middle = finCoinService.getFinCoins(USER, first.nextCursor(), 2);
		assertThat(middle.items()).extracting(FinCoinHistoryResponse::id)
				.containsExactly(8_100_000_005L, 8_100_000_003L);
		assertThat(middle.nextCursor()).isEqualTo(8_100_000_003L);

		FinCoinResponse last = finCoinService.getFinCoins(USER, middle.nextCursor(), 2);
		assertThat(last.items()).extracting(FinCoinHistoryResponse::id).containsExactly(8_100_000_001L);
		assertThat(last.nextCursor()).isNull();
	}

	@Test
	void returnsNullCursorWhenExactlySizeRowsRemain() {
		FinCoinResponse first = finCoinService.getFinCoins(USER, null, 5);
		assertThat(first.items()).hasSize(5);
		assertThat(first.nextCursor()).isNull();

		FinCoinResponse last = finCoinService.getFinCoins(USER, 8_100_000_005L, 2);
		assertThat(last.items()).extracting(FinCoinHistoryResponse::id)
				.containsExactly(8_100_000_003L, 8_100_000_001L);
		assertThat(last.nextCursor()).isNull();
	}

	@Test
	void returnsOneItemAndItsIdAsCursorForSizeOne() {
		FinCoinResponse result = finCoinService.getFinCoins(USER, null, 1);
		assertThat(result.items()).extracting(FinCoinHistoryResponse::id).containsExactly(8_100_000_009L);
		assertThat(result.nextCursor()).isEqualTo(8_100_000_009L);
	}

	@Test
	void mapsAllReasonTextsAndPreservesLedgerValues() {
		FinCoinResponse result = finCoinService.getFinCoins(USER, null, 100);
		assertThat(result.items()).extracting(
				FinCoinHistoryResponse::reasonCode, FinCoinHistoryResponse::reasonText,
				FinCoinHistoryResponse::delta, FinCoinHistoryResponse::balanceAfter, FinCoinHistoryResponse::grantDate
		).containsExactly(
				tuple(FinCoinReason.PURCHASE, "아이템 구매", -150, 700, LocalDate.of(2026, 9, 2)),
				tuple(FinCoinReason.MONTHLY, "월간 보상", 500, 850, LocalDate.of(2026, 9, 4)),
				tuple(FinCoinReason.WEEKLY, "주간 보상", 200, 350, LocalDate.of(2026, 9, 3)),
				tuple(FinCoinReason.CONFIRM_ALL, "거래 내역 전체 확인 보상", 50, 150, LocalDate.of(2026, 9, 10)),
				tuple(FinCoinReason.ATTEND, "출석 보상", 100, 100, LocalDate.of(2026, 9, 5))
		);
		assertThat(result.nextCursor()).isNull();
	}

	@Test
	void isolatesOtherUsersHistory() {
		FinCoinResponse result = finCoinService.getFinCoins(982L, null, 20);
		assertThat(result.items()).extracting(FinCoinHistoryResponse::id)
				.containsExactly(8_100_000_010L, 8_100_000_006L);
		assertThat(result.nextCursor()).isNull();
	}

	@Test
	void returnsEmptyItemsForNewUser() {
		FinCoinResponse result = finCoinService.getFinCoins(983L, null, 20);
		assertThat(result.items()).isEmpty();
		assertThat(result.nextCursor()).isNull();
	}

	@ParameterizedTest
	@ValueSource(longs = {1, 8_100_000_001L})
	void returnsEmptyItemsWhenCursorIsPastAllItems(long cursor) {
		FinCoinResponse result = finCoinService.getFinCoins(USER, cursor, 20);
		assertThat(result.items()).isEmpty();
		assertThat(result.nextCursor()).isNull();
	}

	@Test
	void usesNonexistentCursorAsExclusiveBoundary() {
		FinCoinResponse result = finCoinService.getFinCoins(USER, 8_100_000_004L, 20);
		assertThat(result.items()).extracting(FinCoinHistoryResponse::id)
				.containsExactly(8_100_000_003L, 8_100_000_001L);
		assertThat(result.nextCursor()).isNull();
	}

	@Test
	void usesOtherUsersCursorAsBoundaryWithoutExposingTheirItems() {
		FinCoinResponse result = finCoinService.getFinCoins(USER, 8_100_000_006L, 2);
		assertThat(result.items()).extracting(FinCoinHistoryResponse::id)
				.containsExactly(8_100_000_005L, 8_100_000_003L);
		assertThat(result.nextCursor()).isEqualTo(8_100_000_003L);
	}

	@Test
	void acceptsCursorAboveLatestHistoryId() {
		FinCoinResponse result = finCoinService.getFinCoins(USER, Long.MAX_VALUE, 2);
		assertThat(result.items()).extracting(FinCoinHistoryResponse::id)
				.containsExactly(8_100_000_009L, 8_100_000_007L);
		assertThat(result.nextCursor()).isEqualTo(8_100_000_007L);
	}

	@Test
	void newHistoryBetweenPagesDoesNotRepeatItems() {
		FinCoinResponse first = finCoinService.getFinCoins(USER, null, 2);
		jdbcClient.sql("""
				INSERT INTO fin_coin (id, user_id, delta, balance_after, reason_code, grant_date)
				VALUES (8100000011, 981, 20, 720, 'ATTEND', '2026-09-11')
				""").update();

		FinCoinResponse next = finCoinService.getFinCoins(USER, first.nextCursor(), 2);
		assertThat(next.items()).extracting(FinCoinHistoryResponse::id)
				.containsExactly(8_100_000_005L, 8_100_000_003L);
		assertThat(next.nextCursor()).isEqualTo(8_100_000_003L);
	}

	@ParameterizedTest
	@ValueSource(longs = {984, 985})
	void rejectsDeletedOrMissingUser(long userId) {
		assertThatThrownBy(() -> finCoinService.getFinCoins(userId, null, 20))
				.isInstanceOfSatisfying(BusinessException.class,
						exception -> assertThat(exception.getErrorCode()).isEqualTo(UserErrorCode.USER_NOT_FOUND));
	}
}
