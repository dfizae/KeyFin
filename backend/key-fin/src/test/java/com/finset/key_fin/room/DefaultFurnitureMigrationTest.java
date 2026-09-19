package com.finset.key_fin.room;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.sql.DriverManager;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

@Testcontainers
class DefaultFurnitureMigrationTest {
	@Container
	static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0")
			.withDatabaseName("room_migration").withUsername("keyfin").withPassword("keyfin");

	@Test
	void reusesExistingDefaultsPreservesPlacementAndFillsMissingFurniture() throws Exception {
		Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
				.locations("classpath:db/migration").target("14").load().migrate();
		try (var connection = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
			 var sql = connection.createStatement()) {
			sql.executeUpdate("INSERT INTO users (id, email, password, name) VALUES (1, 'existing@room.test', 'encoded', 'existing'), (2, 'new@room.test', 'encoded', 'new'), (3, 'deleted@room.test', 'encoded', 'deleted')");
			sql.executeUpdate("UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = 3");
			sql.executeUpdate("""
					INSERT INTO items (id, item_category, slot_type, name, price, asset_key, is_active) VALUES
					(501, 'FURNITURE', 'FLOOR', 'Existing sofa', 90, 'sofa_default', TRUE),
					(502, 'FURNITURE', 'FLOOR', 'Existing fridge', 70, 'fridge_default', TRUE),
					(503, 'FURNITURE', 'FLOOR', 'Ordinary chair', 10, 'chair_test', TRUE)
					""");
			sql.executeUpdate("""
					INSERT INTO user_furnitures (id, user_id, item_id, placement_status, placement_direction, position_x, position_y, layer) VALUES
					(601, 1, 501, 'FLOOR', 'FRONT_LEFT', 100.123, 200.456, -3),
					(602, 1, 502, NULL, NULL, NULL, NULL, 0),
					(603, 1, 503, NULL, NULL, NULL, NULL, 0)
					""");
			var flyway = Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
					.locations("classpath:db/migration").target("15").load();
			flyway.migrate();
			assertThat(scalar(sql, "SELECT COUNT(*) FROM items WHERE default_furniture_type IS NOT NULL AND price = 0 AND is_active = FALSE")).isEqualTo(3);
			assertThat(scalar(sql, "SELECT COUNT(*) FROM items WHERE asset_key IN ('sofa_default', 'fridge_default', 'tv_default')")).isEqualTo(3);
			assertThat(scalar(sql, "SELECT COUNT(*) FROM user_furnitures WHERE user_id = 1")).isEqualTo(4);
			assertThat(scalar(sql, "SELECT COUNT(*) FROM user_furnitures WHERE user_id = 2")).isEqualTo(3);
			assertThat(scalar(sql, "SELECT COUNT(*) FROM user_furnitures WHERE user_id = 3")).isZero();
			assertThat(scalar(sql, "SELECT COUNT(*) FROM user_furnitures WHERE id = 601 AND placement_direction = 'FRONT_LEFT' AND position_x = 100.123 AND position_y = 200.456 AND layer = -3")).isEqualTo(1);
			assertThat(scalar(sql, "SELECT COUNT(*) FROM user_furnitures WHERE id = 602 AND placement_status = 'FLOOR' AND position_x = 280.438 AND position_y = 217.813")).isEqualTo(1);
			assertThat(scalar(sql, "SELECT COUNT(*) FROM user_furnitures WHERE id = 603 AND placement_status IS NULL")).isEqualTo(1);
			List<String> before = snapshot(sql);
			flyway.migrate();
			assertThat(snapshot(sql)).isEqualTo(before);
			assertThatThrownBy(() -> sql.executeUpdate("UPDATE items SET is_active = TRUE WHERE default_furniture_type = 'TV'"))
					.isInstanceOf(java.sql.SQLException.class);
		}
	}

	private long scalar(Statement sql, String query) throws Exception {
		try (var rows = sql.executeQuery(query)) { rows.next(); return rows.getLong(1); }
	}

	private List<String> snapshot(Statement sql) throws Exception {
		var snapshot = new ArrayList<String>();
		try (var rows = sql.executeQuery("SELECT id, user_id, item_id, placement_status, placement_direction, position_x, position_y, layer FROM user_furnitures ORDER BY id")) {
			while (rows.next()) {
				StringBuilder row = new StringBuilder();
				for (int index = 1; index <= 8; index++) row.append(rows.getString(index)).append('|');
				snapshot.add(row.toString());
			}
		}
		return snapshot;
	}
}
