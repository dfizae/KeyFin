package com.finset.key_fin.budget.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finset.key_fin.budget.dto.response.BudgetProposalResponse;
import com.finset.key_fin.budget.dto.response.BudgetProposalResponse.EnvelopeProposal;
import com.finset.key_fin.budget.entity.Budget;
import com.finset.key_fin.budget.entity.BudgetEnvelope;
import com.finset.key_fin.budget.exception.BudgetErrorCode;
import com.finset.key_fin.budget.repository.BudgetEnvelopeRepository;
import com.finset.key_fin.budget.repository.BudgetRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class BudgetService {

	private static final String RECENT_SPENT_SQL = """
			SELECT e.id AS envelope_id,
			       e.name AS envelope_name,
			       COALESCE(sp.spent, 0) AS spent
			FROM envelopes e
			LEFT JOIN (
			    SELECT s.envelope_id,
			           SUM(CASE t.exclude_tag
			                   WHEN 'NONE'    THEN t.amount
			                   WHEN 'DUTCH'   THEN COALESCE(t.adjusted_amount, 0)
			                   WHEN 'RESTORE' THEN -t.amount
			                   ELSE 0 END) AS spent
			    FROM transactions t
			    JOIN subcategories s ON s.id = t.subcategory_id
			    WHERE t.user_id = :userId
			      AND t.tx_date >= :fromDate AND t.tx_date < :toDate
			      AND t.status = 'NORMAL'
			      AND t.confirm_status IN ('AUTO', 'CONFIRMED')
			    GROUP BY s.envelope_id
			) sp ON sp.envelope_id = e.id
			ORDER BY e.id
			""";

	private static final String FIRST_TX_DATE_SQL = """
			SELECT MIN(tx_date) FROM transactions
			WHERE user_id = :userId AND tx_date < :toDate
			""";

	private static final int WINDOW_MONTHS = 3;
	private static final int MIN_COVERED_DAYS = 30;
	private static final int DAYS_PER_MONTH = 30;
	private static final String BASIS_RECENT_AVERAGE = "최근 %d개월 평균";
	private static final String BASIS_DEFAULT_TEMPLATE = "기본 템플릿";
	private static final Map<Integer, Long> DEFAULT_TEMPLATE = Map.of(
			1, 600_000L,
			2, 100_000L,
			3, 100_000L,
			4, 100_000L,
			5, 100_000L,
			6, 150_000L,
			7, 100_000L);

	private final JdbcClient jdbc;
	private final Clock clock;
	private final BudgetRepository budgetRepository;
	private final BudgetEnvelopeRepository budgetEnvelopeRepository;
	private final UserRepository userRepository;

	@Transactional
	public BudgetProposalResponse propose(long userId, String month) {
		if (budgetRepository.existsByUserIdAndBudgetMonth(userId, month)) {
			throw new BusinessException(BudgetErrorCode.BUDGET_ALREADY_EXISTS);
		}

		LocalDate referenceDate = LocalDate.now(clock);
		LocalDate windowStart = referenceDate.minusMonths(WINDOW_MONTHS);
		List<EnvelopeSpent> recentSpent = jdbc.sql(RECENT_SPENT_SQL)
				.param("userId", userId)
				.param("fromDate", windowStart)
				.param("toDate", referenceDate)
				.query((rs, rowNum) -> new EnvelopeSpent(
						rs.getInt("envelope_id"),
						rs.getString("envelope_name"),
						rs.getLong("spent")))
				.list();
		boolean noHistory = recentSpent.stream().allMatch(spent -> spent.amount() == 0);
		long coveredDays = noHistory ? MIN_COVERED_DAYS : coveredDays(userId, windowStart, referenceDate);

		Budget budget = budgetRepository.save(
				Budget.propose(userRepository.getReferenceById(userId), month));

		List<BudgetEnvelope> rows = new ArrayList<>();
		List<EnvelopeProposal> proposals = new ArrayList<>();
		for (EnvelopeSpent spent : recentSpent) {
			long monthlyAvg = Math.max(0, spent.amount() * DAYS_PER_MONTH / coveredDays);
			long proposedAmount = noHistory
					? DEFAULT_TEMPLATE.get(spent.envelopeId())
					: roundToThousand(monthlyAvg);
			rows.add(BudgetEnvelope.propose(budget, spent.envelopeId(), proposedAmount));
			proposals.add(new EnvelopeProposal(spent.envelopeId(), spent.name(), proposedAmount, monthlyAvg));
		}
		budgetEnvelopeRepository.saveAll(rows);

		long coveredMonthsLabel = Math.max(1, Math.round(coveredDays / (double) DAYS_PER_MONTH));
		return new BudgetProposalResponse(
				budget.getId(),
				month,
				budget.getStatus().name(),
				noHistory ? BASIS_DEFAULT_TEMPLATE : BASIS_RECENT_AVERAGE.formatted(coveredMonthsLabel),
				proposals);
	}

	private long coveredDays(long userId, LocalDate windowStart, LocalDate referenceDate) {
		LocalDate firstTxDate = jdbc.sql(FIRST_TX_DATE_SQL)
				.param("userId", userId)
				.param("toDate", referenceDate)
				.query(LocalDate.class)
				.optional()
				.orElse(referenceDate);
		long windowDays = ChronoUnit.DAYS.between(windowStart, referenceDate);
		long days = ChronoUnit.DAYS.between(firstTxDate, referenceDate);
		return Math.max(MIN_COVERED_DAYS, Math.min(windowDays, days));
	}

	private static long roundToThousand(long amount) {
		return Math.round(amount / 1000.0) * 1000;
	}

	private record EnvelopeSpent(int envelopeId, String name, long amount) {
	}
}
