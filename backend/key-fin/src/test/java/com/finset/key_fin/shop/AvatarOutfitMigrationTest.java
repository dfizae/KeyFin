package com.finset.key_fin.shop;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
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
class AvatarOutfitMigrationTest {

	@Container
	static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0")
			.withDatabaseName("outfit_migration").withUsername("keyfin").withPassword("keyfin")
			.withCommand("--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci");

	@BeforeEach
	void resetDedicatedTestDatabase() {
		var baseline = Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
				.locations("classpath:db/migration").target("18").cleanDisabled(false).load();
		baseline.clean();
		baseline.migrate();
	}

	@Test
	void seedsThreeInactiveUpperBodySetsWithoutChangingExistingInventory() throws Exception {
		try (var connection = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
			 var sql = connection.createStatement()) {
			sql.executeUpdate("INSERT INTO users (id, email, password, name) VALUES (901, 'outfit@test.io', 'encoded', 'Outfit tester')");
			sql.executeUpdate("INSERT INTO items (id, item_category, slot_type, name, price, asset_key) VALUES (9001, 'AVATAR', 'HEAD', 'Existing hat', 120, 'existing_hat')");
			sql.executeUpdate("INSERT INTO user_items (id, user_id, item_id, equipped_slot) VALUES (9002, 901, 9001, 'HEAD')");
			var beforeItems = rows(sql, "SELECT * FROM items ORDER BY id");
			var beforeInventory = rows(sql, "SELECT * FROM user_items ORDER BY id");
			var beforeFurniture = rows(sql, "SELECT * FROM user_furnitures ORDER BY id");
			var beforeCoins = rows(sql, "SELECT * FROM fin_coin ORDER BY id");

			migrateOutfits();

			assertThat(rows(sql, "SELECT asset_key, item_category, slot_type, name, price, theme_code, is_active, default_furniture_type FROM items WHERE asset_key LIKE 'outfit_%' ORDER BY price"))
					.containsExactly(
							List.of("outfit_epic_mage", "AVATAR", "UPPER_BODY", "에픽 마법사 의상 세트", "500", "<null>", "0", "<null>"),
							List.of("outfit_legendary_paladin", "AVATAR", "UPPER_BODY", "레전더리 성기사 의상 세트", "1000", "<null>", "0", "<null>"),
							List.of("outfit_mythic_dragon", "AVATAR", "UPPER_BODY", "신화 용염 의상 세트", "2000", "<null>", "0", "<null>"));
			assertThat(rows(sql, "SELECT * FROM items WHERE asset_key NOT LIKE 'outfit_%' ORDER BY id")).isEqualTo(beforeItems);
			assertThat(rows(sql, "SELECT * FROM user_items ORDER BY id")).isEqualTo(beforeInventory);
			assertThat(rows(sql, "SELECT * FROM user_furnitures ORDER BY id")).isEqualTo(beforeFurniture);
			assertThat(rows(sql, "SELECT * FROM fin_coin ORDER BY id")).isEqualTo(beforeCoins);
			var after = rows(sql, "SELECT * FROM items ORDER BY id");
			migrateOutfits();
			assertThat(rows(sql, "SELECT * FROM items ORDER BY id")).isEqualTo(after);
		}
	}

	@Test
	void reusesAnIdenticalPreseededItemWithoutChangingItsId() throws Exception {
		try (var connection = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
			 var sql = connection.createStatement()) {
			sql.executeUpdate("INSERT INTO items (id, item_category, slot_type, name, price, asset_key, is_active) VALUES (9001, 'AVATAR', 'UPPER_BODY', '에픽 마법사 의상 세트', 500, 'outfit_epic_mage', FALSE)");
			migrateOutfits();
			assertThat(rows(sql, "SELECT id FROM items WHERE asset_key = 'outfit_epic_mage'"))
					.containsExactly(List.of("9001"));
			assertThat(rows(sql, "SELECT id FROM items WHERE asset_key LIKE 'outfit_%'")).hasSize(3);
		}
	}

	@Test
	void rejectsConflictingCatalogWithoutInsertingTheOtherSets() throws Exception {
		try (var connection = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
			 var sql = connection.createStatement()) {
			sql.executeUpdate("INSERT INTO items (item_category, slot_type, name, price, asset_key, is_active) VALUES ('AVATAR', 'LOWER_BODY', 'Existing conflicting item', 100, 'outfit_epic_mage', TRUE)");
			var before = rows(sql, "SELECT * FROM items ORDER BY id");
			assertThatThrownBy(this::migrateOutfits).hasStackTraceContaining("V19 outfit catalog conflicts");
			assertThat(rows(sql, "SELECT * FROM items ORDER BY id")).isEqualTo(before);
		}
	}

	@Test
	void rejectsDuplicateAssetKeysWithoutInsertingTheOtherSets() throws Exception {
		try (var connection = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
			 var sql = connection.createStatement()) {
			sql.executeUpdate("INSERT INTO items (item_category, slot_type, name, price, asset_key, is_active) VALUES ('AVATAR', 'UPPER_BODY', '에픽 마법사 의상 세트', 500, 'outfit_epic_mage', FALSE), ('AVATAR', 'UPPER_BODY', '에픽 마법사 의상 세트', 500, 'outfit_epic_mage', FALSE)");
			var before = rows(sql, "SELECT * FROM items ORDER BY id");
			assertThatThrownBy(this::migrateOutfits).hasStackTraceContaining("V19 outfit asset keys must identify a single item");
			assertThat(rows(sql, "SELECT * FROM items ORDER BY id")).isEqualTo(before);
		}
	}

	private void migrateOutfits() {
		Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
				.locations("classpath:db/migration").target("19").load().migrate();
	}

	private List<List<String>> rows(Statement sql, String query) throws Exception {
		var result = new ArrayList<List<String>>();
		try (var rows = sql.executeQuery(query)) {
			while (rows.next()) {
				var row = new ArrayList<String>();
				for (int column = 1; column <= rows.getMetaData().getColumnCount(); column++) {
					String value = rows.getString(column);
					row.add(value == null ? "<null>" : value);
				}
				result.add(row);
			}
		}
		return result;
	}
}
