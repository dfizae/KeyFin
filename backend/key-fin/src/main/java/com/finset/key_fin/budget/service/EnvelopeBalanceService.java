package com.finset.key_fin.budget.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class EnvelopeBalanceService {

	private static final String BALANCE_SQL = """
			SELECT be.envelope_id,
			       e.name AS envelope_name,
			       be.confirmed_amount,
			       COALESCE(sp.spent, 0) AS spent
			FROM budgets b
			JOIN budget_envelopes be ON be.budget_id = b.id
			JOIN envelopes e ON e.id = be.envelope_id
			LEFT JOIN (
			    SELECT s.envelope_id,
			           SUM(CASE t.exclude_tag
			                   WHEN 'NONE'  THEN t.amount
			                   WHEN 'DUTCH' THEN COALESCE(t.adjusted_amount, 0)
			                   ELSE 0 END) AS spent
			    FROM transactions t
			    JOIN subcategories s ON s.id = t.subcategory_id
			    WHERE t.user_id = :userId
			      AND t.tx_date >= :fromDate AND t.tx_date < :toDate
			      AND t.status = 'NORMAL'
			      AND t.confirm_status IN ('AUTO', 'CONFIRMED')
			    GROUP BY s.envelope_id
			) sp ON sp.envelope_id = be.envelope_id
			WHERE b.user_id = :userId AND b.budget_month = :month
			ORDER BY be.envelope_id
			""";

	private final JdbcClient jdbc;

	public List<EnvelopeBalance> getMonthlyBalances(long userId, String month) {
		LocalDate from = LocalDate.parse(month + "01", DateTimeFormatter.BASIC_ISO_DATE);
		LocalDate to = from.plusMonths(1);
		return jdbc.sql(BALANCE_SQL)
				.param("userId", userId)
				.param("month", month)
				.param("fromDate", from)
				.param("toDate", to)
				.query((rs, rowNum) -> new EnvelopeBalance(
						rs.getInt("envelope_id"),
						rs.getString("envelope_name"),
						rs.getObject("confirmed_amount", Long.class),
						rs.getLong("spent")))
				.list();
	}

	public Optional<Long> getRemaining(long userId, String month, int envelopeId) {
		return getMonthlyBalances(userId, month).stream()
				.filter(b -> b.envelopeId() == envelopeId)
				.findFirst()
				.map(EnvelopeBalance::remaining);
	}

	public record EnvelopeBalance(int envelopeId, String envelopeName, Long confirmedAmount, long spent) {

		public Long remaining() {
			return confirmedAmount == null ? null : confirmedAmount - spent;
		}
	}
}
