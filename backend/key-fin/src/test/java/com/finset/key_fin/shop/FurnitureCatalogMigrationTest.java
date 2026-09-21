package com.finset.key_fin.shop;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.JsonNode;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static org.assertj.core.api.Assertions.*;

@Testcontainers
class FurnitureCatalogMigrationTest {
	@Container
	static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0")
			.withDatabaseName("catalog_migration").withUsername("keyfin").withPassword("keyfin")
			.withCommand("--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci");

	@TempDir Path replayDirectory;

	@BeforeEach
	void cleanDedicatedTestDatabase() {
		flyway("20").clean();
	}

	@Test
	void buildsEmptyDatabaseWithTheExactReviewedCatalogAndDefaultAliases() throws Exception {
		flyway("20").migrate();
		try (var connection = connection(); var sql = connection.createStatement()) {
			assertCatalog(sql);
			assertThat(rows(sql, "SELECT asset_key, price, is_active FROM items WHERE default_furniture_type IS NOT NULL ORDER BY asset_key"))
					.containsExactly(List.of("fridge_default", "0", "0"), List.of("sofa_default", "0", "0"), List.of("tv_default", "0", "0"));
			assertThat(rows(sql, "SELECT version, success FROM flyway_schema_history WHERE version IN ('19', '20') ORDER BY installed_rank"))
					.containsExactly(List.of("19", "1"), List.of("20", "1"));
		}
	}

	@Test
	void upgradesV18PreservingExistingItemsOwnershipEquipmentPlacementStickersAndCoins() throws Exception {
		flyway("18").migrate();
		try (var connection = connection(); var sql = connection.createStatement()) {
			sql.executeUpdate("INSERT INTO users (id, email, password, name) VALUES (901, 'catalog@test.io', 'encoded', 'Catalog tester')");
			sql.executeUpdate("INSERT INTO items (id, item_category, slot_type, name, price, asset_key) VALUES (9001, 'AVATAR', 'UPPER_BODY', 'Existing shirt', 120, 'existing_shirt')");
			sql.executeUpdate("INSERT INTO user_items (user_id, item_id, equipped_slot) VALUES (901, 9001, 'UPPER_BODY')");
			sql.executeUpdate("""
					INSERT INTO user_furnitures (user_id, item_id, placement_status, placement_direction, position_x, position_y, layer, sticker_attached)
					SELECT 901, id, 'FLOOR', 'FRONT_LEFT', 100.123, 200.456, 2, TRUE FROM items WHERE default_furniture_type IS NOT NULL
					""");
			sql.executeUpdate("INSERT INTO room_sticker_states (user_id, last_removed_date) VALUES (901, '2026-09-20')");
			sql.executeUpdate("INSERT INTO budgets (id, user_id, budget_month, status) VALUES (902, 901, '202609', 'CONFIRMED')");
			sql.executeUpdate("INSERT INTO budget_sticker_applications (budget_id, user_id, applied_at) VALUES (902, 901, '2026-09-20 12:00:00')");
			sql.executeUpdate("INSERT INTO fin_coin (user_id, delta, balance_after, reason_code, grant_date) VALUES (901, 5000, 5000, 'MONTHLY', '2026-09-01')");
			var before = preservedData(sql);
			var oldItems = rows(sql, "SELECT * FROM items ORDER BY id");

			flyway("20").migrate();

			assertCatalog(sql);
			assertThat(preservedData(sql)).isEqualTo(before);
			assertThat(rows(sql, "SELECT * FROM items WHERE id <= 9001 ORDER BY id")).isEqualTo(oldItems);
			assertThat(rows(sql, "SELECT id FROM items WHERE asset_key IN (" + targetKeys() + ")"))
					.allSatisfy(row -> assertThat(Long.parseLong(row.getFirst())).isGreaterThan(9001));

			var after = rows(sql, "SELECT * FROM items ORDER BY id");
			assertThat(flyway("20").migrate().migrationsExecuted).isZero();
			// Execute both SQL bodies again in this disposable database, rather than just a Flyway no-op.
			copyReplay("V19__seed_avatar_outfit_sets.sql", "V21__replay_outfits_test_only.sql");
			copyReplay("V20__seed_furniture_catalog.sql", "V22__replay_furniture_test_only.sql");
			Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
					.locations("classpath:db/migration", "filesystem:" + replayDirectory.toAbsolutePath()).load().migrate();
			assertThat(rows(sql, "SELECT * FROM items ORDER BY id")).isEqualTo(after);
			assertThat(preservedData(sql)).isEqualTo(before);
		}
	}

	@Test
	void reusesAnIdenticalFurnitureItemAndItsOwnershipWithoutChangingIds() throws Exception {
		flyway("19").migrate();
		try (var connection = connection(); var sql = connection.createStatement()) {
			sql.executeUpdate("INSERT INTO users (id, email, password, name) VALUES (901, 'reuse@test.io', 'encoded', 'Reuse tester')");
			sql.executeUpdate("INSERT INTO items (id, item_category, slot_type, name, price, asset_key, is_active) VALUES (9001, 'FURNITURE', 'FLOOR', '원목 책상 (오리지널)', 500, 'desk_original', FALSE)");
			sql.executeUpdate("INSERT INTO user_furnitures (id, user_id, item_id) VALUES (9002, 901, 9001)");
			var owned = rows(sql, "SELECT * FROM user_furnitures ORDER BY id");
			flyway("20").migrate();
			assertCatalog(sql);
			assertThat(rows(sql, "SELECT id FROM items WHERE asset_key = 'desk_original'"))
					.containsExactly(List.of("9001"));
			assertThat(rows(sql, "SELECT * FROM user_furnitures ORDER BY id")).isEqualTo(owned);
		}
	}

	@ParameterizedTest
	@CsvSource({
			"19, name = 'Wrong name'", "20, name = 'Wrong name'",
			"19, price = 1", "20, price = 1",
			"19, slot_type = 'LOWER_BODY'", "20, slot_type = 'WALL'",
			"19, is_active = TRUE", "20, is_active = TRUE",
			"19, theme_code = 'UNEXPECTED'", "20, theme_code = 'UNEXPECTED'",
			"19, asset_key = 'OUTFIT_EPIC_MAGE'", "20, asset_key = 'DESK_ORIGINAL'",
			"19, item_category = 'avatar'", "20, item_category = 'furniture'"
	})
	void rejectsEachConflictingFieldBeforeInsertingAnyTarget(int version, String change) throws Exception {
		flyway(Integer.toString(version - 1)).migrate();
		try (var connection = connection(); var sql = connection.createStatement()) {
			insertTarget(sql, version);
			sql.executeUpdate("UPDATE items SET " + change + " WHERE id = 9001");
			var before = rows(sql, "SELECT * FROM items ORDER BY id");
			assertThatThrownBy(() -> flyway(Integer.toString(version)).migrate())
					.hasStackTraceContaining("catalog conflicts with existing items");
			assertThat(rows(sql, "SELECT * FROM items ORDER BY id")).isEqualTo(before);
		}
	}

	@ParameterizedTest
	@ValueSource(ints = {19, 20})
	void rejectsCategoryConflictsWithoutPartialInsertion(int version) throws Exception {
		flyway(Integer.toString(version - 1)).migrate();
		try (var connection = connection(); var sql = connection.createStatement()) {
			insertTarget(sql, version);
			// Valid category/slot combination in the schema, incompatible with this catalog key.
			sql.executeUpdate(version == 19
					? "UPDATE items SET item_category = 'FURNITURE', slot_type = 'FLOOR' WHERE id = 9001"
					: "UPDATE items SET item_category = 'AVATAR', slot_type = 'HEAD' WHERE id = 9001");
			var before = rows(sql, "SELECT * FROM items ORDER BY id");
			assertThatThrownBy(() -> flyway(Integer.toString(version)).migrate()).hasStackTraceContaining("catalog conflicts");
			assertThat(rows(sql, "SELECT * FROM items ORDER BY id")).isEqualTo(before);
		}
	}

	@Test
	void rejectsDuplicateFurnitureKeysWithoutPartialInsertion() throws Exception {
		flyway("19").migrate();
		try (var connection = connection(); var sql = connection.createStatement()) {
			insertTarget(sql, 20);
			sql.executeUpdate("INSERT INTO items (item_category, slot_type, name, price, asset_key, is_active) SELECT item_category, slot_type, name, price, asset_key, is_active FROM items WHERE id = 9001");
			var before = rows(sql, "SELECT * FROM items ORDER BY id");
			assertThatThrownBy(() -> flyway("20").migrate()).hasStackTraceContaining("V20 furniture asset keys must identify a single item");
			assertThat(rows(sql, "SELECT * FROM items ORDER BY id")).isEqualTo(before);
		}
	}

	private void assertCatalog(Statement sql) throws Exception {
		var items = CatalogFixture.items();
		assertThat(items).hasSize(59);
		assertThat(CatalogFixture.keys()).doesNotHaveDuplicates();
		assertThat(items.stream().filter(i -> i.path("itemCategory").asString().equals("FURNITURE"))).hasSize(56);
		assertThat(items.stream().filter(i -> i.path("slotType").asString().equals("FLOOR") && i.path("price").asInt() == 500)).hasSize(41);
		assertThat(items.stream().filter(i -> i.path("slotType").asString().equals("FLOOR") && i.path("price").asInt() == 200)).hasSize(7);
		assertThat(items.stream().filter(i -> i.path("slotType").asString().equals("WALL") && i.path("price").asInt() == 300)).hasSize(8);
		for (JsonNode item : items) {
			assertThat(item.path("isActive").asBoolean()).isFalse();
			assertThat(item.path("themeCode").isNull()).isTrue();
			assertThat(item.path("defaultFurnitureType").isNull()).isTrue();
			assertThat(rows(sql, "SELECT name, item_category, slot_type, price, is_active, theme_code, default_furniture_type FROM items WHERE asset_key = '" + item.path("assetKey").asString() + "'"))
					.containsExactly(List.of(item.path("name").asString(), item.path("itemCategory").asString(),
							item.path("slotType").asString(), item.path("price").asString(), "0", "<null>", "<null>"));
			assertThat(item.path("views").size()).isEqualTo(item.path("itemCategory").asString().equals("FURNITURE") ? 2 : 3);
		}
		var aliases = new LinkedHashMap<String, String>();
		CatalogFixture.DOCUMENT.path("defaultAliases").forEach(alias -> aliases.put(alias.path("assetKey").asString(), alias.path("sourceAssetKey").asString()));
		assertThat(aliases).isEqualTo(Map.of("sofa_default", "sofa_original", "fridge_default", "refrigerator_original", "tv_default", "tv_set_original"));
		assertThat(CatalogFixture.DOCUMENT.path("excluded").size()).isEqualTo(14);
		var omitted = new ArrayList<>(aliases.values());
		CatalogFixture.DOCUMENT.path("excluded").forEach(item -> omitted.add(item.path("assetKey").asString()));
		for (String key : omitted) assertThat(rows(sql, "SELECT id FROM items WHERE asset_key = '" + key + "'")).isEmpty();
		// Detect accidental extra rows even if all expected keys were also inserted.
		assertThat(rows(sql, "SELECT asset_key FROM items WHERE default_furniture_type IS NULL AND asset_key <> 'existing_shirt'"))
				.extracting(List::getFirst).containsExactlyInAnyOrderElementsOf(CatalogFixture.keys());
	}

	private void insertTarget(Statement sql, int version) throws Exception {
		String values = version == 19
				? "'AVATAR', 'UPPER_BODY', '에픽 마법사 의상 세트', 500, 'outfit_epic_mage'"
				: "'FURNITURE', 'FLOOR', '원목 책상 (오리지널)', 500, 'desk_original'";
		sql.executeUpdate("INSERT INTO items (id, item_category, slot_type, name, price, asset_key, is_active) VALUES (9001, " + values + ", FALSE)");
	}

	private Map<String, List<List<String>>> preservedData(Statement sql) throws Exception {
		var result = new LinkedHashMap<String, List<List<String>>>();
		for (String table : List.of("users", "user_items", "user_furnitures", "room_sticker_states", "budget_sticker_applications", "budgets", "fin_coin")) {
			result.put(table, rows(sql, "SELECT * FROM " + table + " ORDER BY 1"));
		}
		return result;
	}

	private void copyReplay(String source, String destination) throws Exception {
		try (var input = Objects.requireNonNull(getClass().getResourceAsStream("/db/migration/" + source))) {
			Files.copy(input, replayDirectory.resolve(destination));
		}
	}

	private String targetKeys() {
		return String.join(",", CatalogFixture.keys().stream().map(key -> "'" + key + "'").toList());
	}

	private java.sql.Connection connection() throws Exception {
		return DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
	}

	private Flyway flyway(String version) {
		return Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
				.locations("classpath:db/migration").target(version).cleanDisabled(false).load();
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
