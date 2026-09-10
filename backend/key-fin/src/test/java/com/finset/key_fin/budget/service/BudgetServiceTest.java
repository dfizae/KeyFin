package com.finset.key_fin.budget.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

import com.finset.key_fin.budget.dto.response.BudgetProposalResponse;
import com.finset.key_fin.budget.dto.response.BudgetProposalResponse.EnvelopeProposal;
import com.finset.key_fin.budget.exception.BudgetErrorCode;
import com.finset.key_fin.budget.repository.BudgetEnvelopeRepository;
import com.finset.key_fin.global.exception.BusinessException;

@SpringBootTest
@Transactional
@Sql("/sql/budget-proposal-fixture.sql")
class BudgetServiceTest {

	private static final long USER_WITH_HISTORY = 997L;
	private static final long USER_WITHOUT_HISTORY = 996L;
	private static final long USER_WITH_SHORT_HISTORY = 995L;
	private static final long USER_WITH_FRACTIONAL_HISTORY = 994L;
	private static final String MONTH = "202609";

	@TestConfiguration
	static class FixedClockConfig {

		@Bean
		@Primary
		Clock fixedClock() {
			return Clock.fixed(Instant.parse("2026-09-10T03:00:00Z"), ZoneId.of("Asia/Seoul"));
		}
	}

	@Autowired
	private BudgetService budgetService;

	@Autowired
	private BudgetEnvelopeRepository budgetEnvelopeRepository;

	@Test
	@DisplayName("신청일 기준 직전 3개월 순소비를 일수 비례 월평균으로 환산해 봉투 7종 전부 제안한다")
	void proposeFromRecentAverage() {
		BudgetProposalResponse response = budgetService.propose(USER_WITH_HISTORY, MONTH);

		assertThat(response.status()).isEqualTo("PROPOSED");
		assertThat(response.basis()).isEqualTo("최근 3개월 평균");
		assertThat(response.month()).isEqualTo(MONTH);
		assertThat(response.envelopes()).hasSize(7);

		EnvelopeProposal dining = response.envelopes().get(0);
		assertThat(dining.monthlyAvg()).isEqualTo(120652);
		assertThat(dining.proposedAmount()).isEqualTo(121000);

		EnvelopeProposal transport = response.envelopes().get(1);
		assertThat(transport.monthlyAvg()).isEqualTo(32608);
		assertThat(transport.proposedAmount()).isEqualTo(33000);

		assertThat(response.envelopes().get(2).proposedAmount()).isZero();
		assertThat(budgetEnvelopeRepository.findAll())
				.filteredOn(row -> row.getBudget().getId().equals(response.budgetId()))
				.hasSize(7);
	}

	@Test
	@DisplayName("이력이 한 달 미만이면 확대 없이 그대로 평균으로 쓴다 (하한 30일)")
	void proposeFromShortHistory() {
		BudgetProposalResponse response = budgetService.propose(USER_WITH_SHORT_HISTORY, MONTH);

		assertThat(response.basis()).isEqualTo("최근 1개월 평균");
		assertThat(response.envelopes().get(0).monthlyAvg()).isEqualTo(90000);
		assertThat(response.envelopes().get(0).proposedAmount()).isEqualTo(90000);
	}

	@Test
	@DisplayName("부분 달 이력은 커버 일수에 비례해 환산한다 (77일치 → ×30/77)")
	void proposeFromFractionalHistory() {
		BudgetProposalResponse response = budgetService.propose(USER_WITH_FRACTIONAL_HISTORY, MONTH);

		assertThat(response.envelopes().get(0).monthlyAvg()).isEqualTo(89610);
		assertThat(response.envelopes().get(0).proposedAmount()).isEqualTo(90000);
	}

	@Test
	@DisplayName("이력이 없으면 기본 템플릿(합계 125만)으로 제안한다")
	void proposeFromDefaultTemplate() {
		BudgetProposalResponse response = budgetService.propose(USER_WITHOUT_HISTORY, MONTH);

		assertThat(response.basis()).isEqualTo("기본 템플릿");
		assertThat(response.envelopes())
				.extracting(EnvelopeProposal::proposedAmount)
				.containsExactly(600000L, 100000L, 100000L, 100000L, 100000L, 150000L, 100000L);
	}

	@Test
	@DisplayName("같은 주기의 제안이 이미 있으면 BUDGET_ALREADY_EXISTS")
	void rejectDuplicateProposal() {
		budgetService.propose(USER_WITH_HISTORY, MONTH);

		assertThatThrownBy(() -> budgetService.propose(USER_WITH_HISTORY, MONTH))
				.isInstanceOf(BusinessException.class)
				.extracting(e -> ((BusinessException) e).getErrorCode())
				.isEqualTo(BudgetErrorCode.BUDGET_ALREADY_EXISTS);
	}
}
