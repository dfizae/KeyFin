package com.finset.key_fin.coaching;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.datasource.DataSourceUtils;
import javax.sql.DataSource;
import com.finset.key_fin.budget.service.BudgetPeriod;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/** Read-only projection of V1 source tables. No account numbers, CVCs or provider keys are selected. */
@Repository
public class CoachingSourceRepository {
    private final JdbcClient jdbc;
    private final DataSource database;
    public CoachingSourceRepository(JdbcClient jdbc, DataSource database) {
        this.jdbc = jdbc;
        this.database = database;
    }

    public record Row(long id, String source, String type, Long accountId, Long cardId, Long merchantId,
                      String merchant, long amount, LocalDate date, LocalTime time, String subcategory,
                      String envelope, String confirmed, String excluded, Long adjustedAmount,
                      String status, boolean accountOwned, boolean cardOwned) { }
    public record Budget(String name, Long confirmedAmount, long spent) { }
    public record Source(List<Row> rows, List<Budget> budgets, long futureRows, BudgetPeriod period) { }

    /** The same repeatable-read snapshot supplies rows and authoritative envelope balances. */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Source read(long userId, LocalDate asOf) {
        var rows = jdbc.sql("""
                SELECT t.id, t.source, t.tx_type, t.account_id, t.card_id, t.merchant_id,
                       t.merchant_name_raw, t.amount, t.tx_date, t.tx_time, s.name AS subcategory,
                       e.name AS envelope, t.confirm_status, t.exclude_tag, t.adjusted_amount, t.status,
                       a.id AS owned_account, c.id AS owned_card
                FROM transactions t
                LEFT JOIN accounts a ON a.id=t.account_id AND a.user_id=t.user_id
                LEFT JOIN cards c ON c.id=t.card_id AND c.user_id=t.user_id
                LEFT JOIN subcategories s ON s.id=t.subcategory_id
                LEFT JOIN envelopes e ON e.id=s.envelope_id
                WHERE t.user_id=:userId AND t.tx_date>=:fromDate AND t.tx_date<=:asOf
                ORDER BY t.tx_date,t.tx_time,t.id LIMIT 10001
                """).param("userId", userId).param("fromDate", asOf.minusDays(364)).param("asOf", asOf)
                .query((rs, index) -> new Row(rs.getLong("id"), rs.getString("source"), rs.getString("tx_type"),
                        rs.getObject("account_id", Long.class), rs.getObject("card_id", Long.class),
                        rs.getObject("merchant_id", Long.class), rs.getString("merchant_name_raw"), rs.getLong("amount"),
                        rs.getObject("tx_date", LocalDate.class), rs.getObject("tx_time", LocalTime.class),
                        rs.getString("subcategory"), rs.getString("envelope"), rs.getString("confirm_status"),
                        rs.getString("exclude_tag"), rs.getObject("adjusted_amount", Long.class), rs.getString("status"),
                        rs.getObject("owned_account") != null, rs.getObject("owned_card") != null)).list();
        // Older V1 schema predates this entity column. Where present, respect the user's 1..28
        // anchor instead of assuming a calendar month; never include rows after the cut-off.
        var period = BudgetPeriod.current(asOf, anchorDay(userId));
        var budgets = jdbc.sql("""
                SELECT e.name,be.confirmed_amount,COALESCE(sp.spent,0) AS spent
                FROM budgets b JOIN budget_envelopes be ON be.budget_id=b.id
                JOIN envelopes e ON e.id=be.envelope_id
                LEFT JOIN (
                    SELECT s.envelope_id,SUM(CASE t.exclude_tag
                        WHEN 'NONE' THEN t.amount WHEN 'DUTCH' THEN COALESCE(t.adjusted_amount,0)
                        WHEN 'RESTORE' THEN -t.amount ELSE 0 END) AS spent
                    FROM transactions t JOIN subcategories s ON s.id=t.subcategory_id
                    WHERE t.user_id=:userId AND t.tx_date>=:monthStart AND t.tx_date<=:asOf
                      AND t.status='NORMAL' AND t.confirm_status IN ('AUTO','CONFIRMED')
                    GROUP BY s.envelope_id
                ) sp ON sp.envelope_id=be.envelope_id
                WHERE b.user_id=:userId AND b.budget_month=:month AND b.status='CONFIRMED'
                ORDER BY be.envelope_id
                """).param("userId", userId).param("monthStart", period.from())
                .param("asOf", asOf).param("month", period.month())
                .query((rs, index) -> new Budget(rs.getString("name"), rs.getObject("confirmed_amount", Long.class),
                        rs.getLong("spent"))).list();
        long futureRows = jdbc.sql("SELECT COUNT(*) FROM transactions WHERE user_id=:userId AND tx_date>:asOf")
                .param("userId", userId).param("asOf", asOf).query(Long.class).single();
        return new Source(rows, budgets, futureRows, period);
    }

    private int anchorDay(long userId) {
        var connection = DataSourceUtils.getConnection(database);
        try {
            boolean exists;
            try (var columns = connection.getMetaData().getColumns(connection.getCatalog(), null, "user_settings", "budget_anchor_day")) {
                exists = columns.next();
            }
            if (!exists) {
                try (var columns = connection.getMetaData().getColumns(connection.getCatalog(), null, "USER_SETTINGS", "BUDGET_ANCHOR_DAY")) {
                    exists = columns.next();
                }
            }
            if (!exists) {
                return 1; // V1's persisted calendar-month contract, not a guessed balance.
            }
            int day = jdbc.sql("SELECT budget_anchor_day FROM user_settings WHERE user_id=:userId")
                    .param("userId", userId).query(Integer.class).optional().orElse(1);
            if (day < 1 || day > 28) {
                throw new IllegalStateException("Source budget anchor must be 1..28");
            }
            return day;
        } catch (java.sql.SQLException exception) {
            throw new IllegalStateException("Cannot verify source budget period", exception);
        } finally {
            DataSourceUtils.releaseConnection(connection, database);
        }
    }
}
