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
	void upgradesV22PreservingOwnershipSelectedCoordinatesStickersAndHistory() throws Exception {
		flyway("22").migrate();
		try (var connection = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
			 var sql = connection.createStatement()) {
			sql.executeUpdate("""
					INSERT INTO users (id, email, password, name) VALUES
					(1, 'duplicates@test.io', 'x', '중복'), (2, 'missing@test.io', 'x', '누락'),
					(3, 'default@test.io', 'x', '기본'), (4, 'deleted@test.io', 'x', '탈퇴'),
					(5, 'stored@test.io', 'x', '보관')
					""");
			sql.executeUpdate("UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = 4");
			sql.executeUpdate("""
					INSERT INTO user_furnitures (user_id, item_id, placement_status, placement_direction, position_x, position_y, layer, sticker_attached)
					SELECT u.id, i.id, 'FLOOR', 'FRONT_LEFT', 100.123, 500.456, -4, TRUE
					FROM users u CROSS JOIN items i WHERE u.id IN (1, 3, 4) AND i.default_furniture_type IS NOT NULL
					""");
			insertPlaced(sql, 9001, "sofa_black", "2026-09-20 12:00:00");
			insertPlaced(sql, 9002, "sofa_pink", "2026-09-20 12:00:00");
			insertPlaced(sql, 9003, "refrigerator_black", "2026-09-21 12:00:00");
			insertPlaced(sql, 9004, "refrigerator_pink", "2026-09-19 12:00:00");
			insertPlaced(sql, 9005, "tv_set_black", "2026-09-20 12:00:00");
			sql.executeUpdate("INSERT INTO user_furnitures (user_id, item_id, sticker_attached) SELECT 5, id, TRUE FROM items WHERE asset_key = 'sofa_black'");
			sql.executeUpdate("INSERT INTO room_sticker_states (user_id, last_removed_date) VALUES (1, '2026-09-21')");
			sql.executeUpdate("INSERT INTO budgets (id, user_id, budget_month, status) VALUES (7001, 1, '202609', 'CONFIRMED')");
			sql.executeUpdate("INSERT INTO budget_sticker_applications (budget_id, user_id, applied_at) VALUES (7001, 1, '2026-09-20 12:00:00')");
			var ownership = rows(sql, "SELECT id, item_id, acquired_at FROM user_furnitures WHERE user_id = 1 ORDER BY id");
			var deleted = rows(sql, "SELECT * FROM user_furnitures WHERE user_id = 4 ORDER BY id");
			var normal = rows(sql, "SELECT * FROM user_furnitures WHERE user_id = 3 ORDER BY id");
			var removals = rows(sql, "SELECT * FROM room_sticker_states");
			var applications = rows(sql, "SELECT * FROM budget_sticker_applications");

			flyway("latest").migrate();
			assertThat(scalar(sql, "SELECT COUNT(*) FROM items WHERE furniture_type IS NOT NULL")).isEqualTo(12);
			assertThat(scalar(sql, "SELECT COUNT(*) FROM items WHERE default_furniture_type IS NOT NULL AND price = 0 AND is_active = FALSE")).isEqualTo(3);
			assertThat(scalar(sql, "SELECT COUNT(*) FROM items WHERE furniture_type IS NOT NULL AND default_furniture_type IS NULL AND is_active = TRUE")).isEqualTo(9);
			assertThat(rows(sql, "SELECT id FROM user_furnitures WHERE user_id = 1 AND placement_status IS NOT NULL ORDER BY id"))
					.containsExactly("9002|", "9003|", "9005|");
			assertThat(scalar(sql, "SELECT COUNT(*) FROM user_furnitures WHERE id IN (9002,9003,9005) AND position_x = 327 AND position_y = 586 AND placement_direction = 'FRONT_LEFT' AND layer = -7 AND sticker_attached = TRUE")).isEqualTo(3);
			assertThat(scalar(sql, "SELECT COUNT(*) FROM user_furnitures WHERE user_id = 1 AND placement_status IS NULL AND position_x IS NULL AND position_y IS NULL AND placement_direction IS NULL AND layer = 0 AND sticker_attached = FALSE")).isEqualTo(5);
			assertThat(rows(sql, "SELECT id, item_id, acquired_at FROM user_furnitures WHERE user_id = 1 ORDER BY id")).isEqualTo(ownership);
			assertThat(rows(sql, "SELECT * FROM user_furnitures WHERE user_id = 4 ORDER BY id")).isEqualTo(deleted);
			assertThat(rows(sql, "SELECT * FROM user_furnitures WHERE user_id = 3 ORDER BY id")).isEqualTo(normal);
			assertThat(rows(sql, "SELECT * FROM room_sticker_states")).isEqualTo(removals);
			assertThat(rows(sql, "SELECT * FROM budget_sticker_applications")).isEqualTo(applications);
			assertThat(scalar(sql, "SELECT COUNT(*) FROM user_furnitures WHERE user_id = 2 AND placement_status = 'FLOOR'")).isEqualTo(3);
			assertThat(scalar(sql, "SELECT COUNT(*) FROM user_furnitures uf JOIN items i ON i.id = uf.item_id WHERE uf.user_id = 5 AND i.default_furniture_type = 'SOFA' AND uf.sticker_attached = TRUE AND uf.placement_status = 'FLOOR'")).isEqualTo(1);
			assertThat(scalar(sql, "SELECT COUNT(*) FROM user_furnitures WHERE user_id = 5 AND placement_status IS NULL AND sticker_attached = FALSE")).isEqualTo(1);
			assertThat(scalar(sql, """
					SELECT COUNT(*) FROM (
					  SELECT u.id, kinds.kind FROM users u
					  CROSS JOIN (SELECT 'FRIDGE' kind UNION ALL SELECT 'SOFA' UNION ALL SELECT 'TV') kinds
					  LEFT JOIN (user_furnitures uf JOIN items i ON i.id = uf.item_id)
					    ON uf.user_id = u.id AND i.furniture_type = kinds.kind AND uf.placement_status IS NOT NULL
					  WHERE u.deleted_at IS NULL GROUP BY u.id, kinds.kind HAVING COUNT(uf.id) <> 1
					) invalid
					""")).isZero();

			assertThatThrownBy(() -> sql.executeUpdate("UPDATE items SET furniture_type = NULL WHERE asset_key = 'sofa_default'"))
					.isInstanceOf(java.sql.SQLException.class).hasMessageContaining("chk_default_furniture_type_match");
			assertThatThrownBy(() -> sql.executeUpdate("UPDATE items SET furniture_type = 'TV' WHERE asset_key = 'sofa_default'"))
					.isInstanceOf(java.sql.SQLException.class).hasMessageContaining("chk_default_furniture_type_match");
			assertThatThrownBy(() -> sql.executeUpdate("UPDATE items SET furniture_type = 'SOFA' WHERE asset_key = 'decor_round_mirror'"))
					.isInstanceOf(java.sql.SQLException.class).hasMessageContaining("chk_furniture_type");
			assertThatThrownBy(() -> sql.executeUpdate("UPDATE items SET furniture_type = 'OTHER' WHERE asset_key = 'desk_original'"))
					.isInstanceOf(java.sql.SQLException.class).hasMessageContaining("chk_furniture_type");
			var all = rows(sql, "SELECT * FROM user_furnitures ORDER BY id");
			flyway("latest").migrate();
			assertThat(rows(sql, "SELECT * FROM user_furnitures ORDER BY id")).isEqualTo(all);
		}
	}

	private Flyway flyway(String target) {
		return Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
				.locations("classpath:db/migration").target(target).load();
	}
	private void insertPlaced(Statement sql, long id, String asset, String acquiredAt) throws Exception {
		sql.executeUpdate("INSERT INTO user_furnitures (id,user_id,item_id,placement_status,placement_direction,position_x,position_y,layer,acquired_at) "
				+ "SELECT " + id + ",1,id,'FLOOR','FRONT_LEFT',327,586,-7,'" + acquiredAt + "' FROM items WHERE asset_key = '" + asset + "'");
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
