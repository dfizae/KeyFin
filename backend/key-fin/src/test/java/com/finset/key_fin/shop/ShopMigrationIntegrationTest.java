package com.finset.key_fin.shop;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

@Testcontainers
class ShopMigrationIntegrationTest {
	@Container
	static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0")
			.withDatabaseName("shop_migration").withUsername("keyfin").withPassword("keyfin");

	@Test
	void preservesExistingLedgerAndRewardUniquenessWhileAllowingMultiplePurchases() throws Exception {
		Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
				.locations("classpath:db/migration").target("12").load().migrate();
		try (var connection = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
			 var sql = connection.createStatement()) {
			sql.executeUpdate("INSERT INTO users (id, email, password, name) VALUES (1, 'migration@test.io', 'encoded', 'tester')");
			sql.executeUpdate("""
					INSERT INTO fin_coin (id, user_id, delta, balance_after, reason_code, grant_date, created_at, ref_id) VALUES
					(1, 1, 100, 100, 'ATTEND', '2026-09-17', '2026-09-17 10:00:00', NULL),
					(2, 1, -30, 70, 'PURCHASE', '2026-09-17', '2026-09-17 10:01:00', '123')
					""");
			List<List<Object>> before = snapshot(sql);
			assertThatThrownBy(() -> sql.executeUpdate("INSERT INTO fin_coin (user_id, delta, balance_after, reason_code, grant_date) VALUES (1, -20, 50, 'PURCHASE', '2026-09-17')"))
					.isInstanceOf(SQLException.class);

			Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
					.locations("classpath:db/migration").load().migrate();

			assertThat(snapshot(sql)).isEqualTo(before);
			sql.executeUpdate("INSERT INTO fin_coin (user_id, delta, balance_after, reason_code, grant_date) VALUES (1, -20, 50, 'PURCHASE', '2026-09-17')");
			sql.executeUpdate("INSERT INTO fin_coin (user_id, delta, balance_after, reason_code, grant_date) VALUES (1, 0, 50, 'PURCHASE', '2026-09-17')");
			for (String reason : List.of("ATTEND", "CONFIRM_ALL", "WEEKLY", "MONTHLY")) {
				String insert = "INSERT INTO fin_coin (user_id, delta, balance_after, reason_code, grant_date) VALUES (1, 10, 60, '" + reason + "', '2026-09-17')";
				if (!reason.equals("ATTEND")) sql.executeUpdate(insert);
				assertThatThrownBy(() -> sql.executeUpdate(insert)).isInstanceOf(SQLException.class);
			}
			sql.executeUpdate("INSERT INTO fin_coin (user_id, delta, balance_after, reason_code, grant_date) VALUES (1, 10, 70, 'ATTEND', '2026-09-18')");
			try (var rows = sql.executeQuery("SELECT COUNT(*) FROM fin_coin WHERE reason_code = 'PURCHASE' AND reward_grant_date IS NULL")) {
				assertThat(rows.next()).isTrue();
				assertThat(rows.getInt(1)).isEqualTo(3);
			}
			try (var rows = sql.executeQuery("SHOW INDEX FROM fin_coin WHERE Key_name = 'idx_fin_coin_user_id'")) {
				List<String> columns = new ArrayList<>();
				while (rows.next()) columns.add(rows.getString("Column_name"));
				assertThat(columns).containsExactly("user_id", "id");
			}
		}
	}

	private List<List<Object>> snapshot(java.sql.Statement sql) throws SQLException {
		List<List<Object>> values = new ArrayList<>();
		try (var rows = sql.executeQuery("SELECT id, user_id, delta, balance_after, reason_code, grant_date, created_at, ref_id FROM fin_coin ORDER BY id")) {
			while (rows.next()) {
				List<Object> row = new ArrayList<>();
				for (int index = 1; index <= 8; index++) row.add(rows.getObject(index));
				values.add(row);
			}
		}
		return values;
	}
}
