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
class EssentialFurnitureMigrationTest {
	@Container
	static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0")
			.withDatabaseName("essential_migration").withUsername("keyfin").withPassword("keyfin");

	@Test
	void upgradesV22ClassifyingCatalogWithoutChangingUserFurniture() throws Exception {
		flyway("22").migrate();
		try (var connection = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
			 var sql = connection.createStatement()) {
			sql.executeUpdate("""
					INSERT INTO users (id, email, password, name) VALUES
					(1, 'default@test.io', 'x', '기본'), (2, 'uninitialized@test.io', 'x', '미초기화')
					""");
			sql.executeUpdate("""
					INSERT INTO user_furnitures (user_id, item_id, placement_status, placement_direction, position_x, position_y, layer, sticker_attached)
					SELECT u.id, i.id, 'FLOOR', 'FRONT_LEFT', 100.123, 500.456, -4, TRUE
					FROM users u CROSS JOIN items i WHERE u.id = 1 AND i.default_furniture_type IS NOT NULL
					""");
			var existing = rows(sql, "SELECT * FROM user_furnitures ORDER BY id");

			assertThat(flyway("latest").migrate().migrationsExecuted).isEqualTo(1);
			assertThat(rows(sql, "SELECT asset_key, furniture_type FROM items WHERE furniture_type IS NOT NULL ORDER BY asset_key"))
					.containsExactly(
							"fridge_default|FRIDGE|", "refrigerator_black|FRIDGE|", "refrigerator_pink|FRIDGE|", "refrigerator_sunset|FRIDGE|",
							"sofa_black|SOFA|", "sofa_default|SOFA|", "sofa_pink|SOFA|", "sofa_sunset|SOFA|",
							"tv_default|TV|", "tv_set_black|TV|", "tv_set_pink|TV|", "tv_set_sunset|TV|");
			assertThat(scalar(sql, "SELECT COUNT(*) FROM items WHERE default_furniture_type IS NOT NULL AND price = 0 AND is_active = FALSE")).isEqualTo(3);
			assertThat(scalar(sql, "SELECT COUNT(*) FROM items WHERE furniture_type IS NOT NULL AND default_furniture_type IS NULL AND is_active = TRUE")).isEqualTo(9);
			assertThat(rows(sql, "SELECT * FROM user_furnitures ORDER BY id")).isEqualTo(existing);
			assertThat(scalar(sql, "SELECT COUNT(*) FROM user_furnitures WHERE user_id = 2")).isZero();

			assertThatThrownBy(() -> sql.executeUpdate("UPDATE items SET furniture_type = NULL WHERE asset_key = 'sofa_default'"))
					.isInstanceOf(java.sql.SQLException.class).hasMessageContaining("chk_default_furniture_type_match");
			assertThatThrownBy(() -> sql.executeUpdate("UPDATE items SET furniture_type = 'TV' WHERE asset_key = 'sofa_default'"))
					.isInstanceOf(java.sql.SQLException.class).hasMessageContaining("chk_default_furniture_type_match");
			assertThatThrownBy(() -> sql.executeUpdate("UPDATE items SET furniture_type = 'SOFA' WHERE asset_key = 'decor_round_mirror'"))
					.isInstanceOf(java.sql.SQLException.class).hasMessageContaining("chk_furniture_type");
			assertThatThrownBy(() -> sql.executeUpdate("UPDATE items SET furniture_type = 'OTHER' WHERE asset_key = 'desk_original'"))
					.isInstanceOf(java.sql.SQLException.class).hasMessageContaining("chk_furniture_type");
			assertThat(flyway("latest").migrate().migrationsExecuted).isZero();
			assertThat(rows(sql, "SELECT * FROM user_furnitures ORDER BY id")).isEqualTo(existing);
		}
	}

	private Flyway flyway(String target) {
		return Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
				.locations("classpath:db/migration").target(target).load();
	}
	private long scalar(Statement sql, String query) throws Exception {
		try (var result = sql.executeQuery(query)) { result.next(); return result.getLong(1); }
	}
	private List<String> rows(Statement sql, String query) throws Exception {
		var result = new ArrayList<String>();
		try (var rows = sql.executeQuery(query)) {
			while (rows.next()) {
				var row = new StringBuilder();
				for (int i = 1; i <= rows.getMetaData().getColumnCount(); i++) row.append(rows.getString(i)).append('|');
				result.add(row.toString());
			}
		}
		return result;
	}
}
