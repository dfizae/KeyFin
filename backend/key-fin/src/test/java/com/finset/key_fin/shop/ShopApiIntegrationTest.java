package com.finset.key_fin.shop;

import com.finset.key_fin.auth.jwt.JwtTokenProvider;
import com.finset.key_fin.fincoin.entity.FinCoin;
import com.finset.key_fin.fincoin.entity.FinCoinReason;
import com.finset.key_fin.fincoin.repository.FinCoinRepository;
import com.finset.key_fin.fincoin.service.FinCoinService;
import com.finset.key_fin.shop.service.ShopService;
import com.finset.key_fin.support.SpringIntegrationTestSupport;
import com.finset.key_fin.user.entity.User;
import com.finset.key_fin.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
@Import(ShopApiIntegrationTest.TimeConfig.class)
@Timeout(90)
class ShopApiIntegrationTest extends SpringIntegrationTestSupport {
	private static final LocalDate PURCHASE_DATE = LocalDate.of(2026, 9, 18);
	@Autowired private MockMvc mvc;
	@Autowired private JdbcClient jdbc;
	@Autowired private UserRepository users;
	@Autowired private FinCoinRepository coins;
	@Autowired private JwtTokenProvider tokens;
	@Autowired private ShopService shop;
	@Autowired private FinCoinService finCoinService;
	@Autowired private PlatformTransactionManager transactions;
	private final List<Long> userIds = new ArrayList<>();
	private final List<Long> itemIds = new ArrayList<>();
	private long userId;

	@BeforeEach
	void setUp() {
		userId = createUser();
	}

	@AfterEach
	void cleanup() {
		for (long id : userIds) {
			jdbc.sql("DELETE FROM user_items WHERE user_id = :id").param("id", id).update();
			jdbc.sql("DELETE FROM user_furnitures WHERE user_id = :id").param("id", id).update();
			jdbc.sql("DELETE FROM fin_coin WHERE user_id = :id").param("id", id).update();
			users.deleteById(id);
		}
		for (long id : itemIds) jdbc.sql("DELETE FROM items WHERE id = :id").param("id", id).update();
	}

	@Test
	void stagedCatalogIsHiddenAndCannotBePurchased() throws Exception {
		seedBalance(5000);
		List<String> catalogKeys = CatalogFixture.keys();
		assertThat(catalogKeys).hasSize(59);
		assertThat(shop.getItems(userId, null, null))
				.extracting(item -> item.assetKey()).doesNotContainAnyElementsOf(catalogKeys);
		for (String assetKey : catalogKeys) {
			long itemId = jdbc.sql("SELECT id FROM items WHERE asset_key = :assetKey")
					.param("assetKey", assetKey).query(Long.class).single();
			mvc.perform(auth(post("/api/v1/shop/purchase").contentType(APPLICATION_JSON)
					.content("{\"itemId\":" + itemId + "}")))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.code").value("SHOP_001"));
		}
		assertThat(jdbc.sql("SELECT COUNT(*) FROM user_items WHERE user_id = :id")
				.param("id", userId).query(Long.class).single()).isZero();
		assertThat(jdbc.sql("SELECT COUNT(*) FROM user_furnitures WHERE user_id = :id")
				.param("id", userId).query(Long.class).single()).isZero();
		assertThat(jdbc.sql("SELECT COUNT(*) FROM fin_coin WHERE user_id = :id")
				.param("id", userId).query(Long.class).single()).isEqualTo(1);
		assertThat(jdbc.sql("SELECT balance_after FROM fin_coin WHERE user_id = :id ORDER BY id DESC LIMIT 1")
				.param("id", userId).query(Integer.class).single()).isEqualTo(5000);
	}

	@Test
	@Transactional // Activation and purchases are rolled back in the disposable Testcontainers database.
	void activatedOutfitsCanBePurchasedAndReplaceOnlyTheUpperBodySlot() throws Exception {
		seedBalance(5000);
		long hat = createItem("AVATAR", "HEAD", 0, true);
		long ownedHat = shop.purchase(userId, hat).userItemId();
		mvc.perform(auth(patch("/api/v1/items/" + ownedHat)).contentType(APPLICATION_JSON).content("{\"equipped\":true}"))
				.andExpect(status().isOk());

		for (String key : List.of("outfit_epic_mage", "outfit_legendary_paladin")) {
			long id = activateCatalogItemForTest(key);
			int price = key.equals("outfit_epic_mage") ? 500 : 1000;
			purchase(id).andExpect(status().isOk()).andExpect(jsonPath("$.data.price").value(price));
			long owned = jdbc.sql("SELECT id FROM user_items WHERE user_id = :user AND item_id = :item")
					.param("user", userId).param("item", id).query(Long.class).single();
			mvc.perform(auth(patch("/api/v1/items/" + owned)).contentType(APPLICATION_JSON).content("{\"equipped\":true}"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.equipped[*].userItemId", containsInAnyOrder((int) ownedHat, (int) owned)))
					.andExpect(jsonPath("$.data.equipped[?(@.slotType == 'UPPER_BODY')].assetKey", contains(key)));
		}
		assertThat(count("SELECT COUNT(*) FROM user_items WHERE user_id = :id AND equipped_slot = 'UPPER_BODY'")).isEqualTo(1);
		assertThat(count("SELECT COUNT(*) FROM user_items WHERE user_id = :id AND equipped_slot IS NULL")).isEqualTo(1);
		assertThat(balance()).isEqualTo(3500);
	}

	@Test
	@Transactional
	void activatedFloorAndWallFurnitureCanBePurchasedAndPlacedIndividually() throws Exception {
		seedBalance(5000);
		for (String key : List.of("desk_original", "window_sky_clouds")) {
			long id = activateCatalogItemForTest(key);
			boolean floor = key.equals("desk_original");
			purchase(id).andExpect(status().isOk()).andExpect(jsonPath("$.data.price").value(floor ? 500 : 300));
			long owned = jdbc.sql("SELECT id FROM user_furnitures WHERE user_id = :user AND item_id = :item")
					.param("user", userId).param("item", id).query(Long.class).single();
			String placement = floor ? "FLOOR" : "LEFT_WALL";
			mvc.perform(auth(patch("/api/v1/furnitures/" + owned)).contentType(APPLICATION_JSON).content("""
					{"placed":true,"placementStatus":"%s","placementDirection":"FRONT_LEFT","positionX":100.123,"positionY":200.456,"layer":2}
					""".formatted(placement)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data.assetKey").value(key))
					.andExpect(jsonPath("$.data.placementStatus").value(placement))
					.andExpect(jsonPath("$.data.canUnplace").value(true));
			mvc.perform(auth(get("/api/v1/furnitures")))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.data[?(@.assetKey == '" + key + "')].positionX", contains(100.123)))
					.andExpect(jsonPath("$.data[?(@.assetKey == '" + key + "')].layer", contains(2)));
		}
		assertThat(count("SELECT COUNT(*) FROM user_furnitures WHERE user_id = :id AND placement_status IS NOT NULL")).isEqualTo(2);
		assertThat(balance()).isEqualTo(4200);
	}

	private long activateCatalogItemForTest(String key) {
		jdbc.sql("UPDATE items SET is_active = TRUE WHERE asset_key = :key").param("key", key).update();
		return jdbc.sql("SELECT id FROM items WHERE asset_key = :key").param("key", key).query(Long.class).single();
	}

	@Test
	void listsActiveCatalogInOrderWithOwnedFlagsAndFilters() throws Exception {
		long avatar = createItem("AVATAR", "HEAD", 0, true);
		long furniture = createItem("FURNITURE", "FLOOR", 0, true);
		long unowned = createItem("AVATAR", "FACE", 10, true);
		createItem("AVATAR", "HEAD", 10, false);
		shop.purchase(userId, avatar);
		shop.purchase(userId, furniture);

		mvc.perform(auth(get("/api/v1/shop")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data[*].itemId").value(contains((int) avatar, (int) furniture, (int) unowned)))
				.andExpect(jsonPath("$.data[*].owned").value(contains(true, true, false)))
				.andExpect(jsonPath("$.data[0].assetKey").isString())
				.andExpect(jsonPath("$.data[0].themeCode").value(nullValue()))
				.andExpect(jsonPath("$.data[0].price").value(0));
		mvc.perform(auth(get("/api/v1/shop").param("itemCategory", "AVATAR")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data[*].itemId").value(contains((int) avatar, (int) unowned)));
		mvc.perform(auth(get("/api/v1/shop").param("slotType", "FLOOR")))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data[0].itemId").value(furniture));
		mvc.perform(auth(get("/api/v1/shop").param("itemCategory", "AVATAR").param("slotType", "HEAD")))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data[*].itemId").value(contains((int) avatar)));
		mvc.perform(auth(get("/api/v1/shop").param("slotType", "FOOTWEAR")))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
		long other = createUser();
		mvc.perform(get("/api/v1/shop").header("Authorization", "Bearer " + tokens.generateAccessToken(other)))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data[*].owned").value(contains(false, false, false)));
	}

	@ParameterizedTest
	@ValueSource(strings = {"", "avatar", "UNKNOWN", " "})
	void rejectsInvalidFilters(String value) throws Exception {
		for (String field : List.of("itemCategory", "slotType")) {
			mvc.perform(auth(get("/api/v1/shop").param(field, value)))
					.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMMON_001"));
		}
	}

	@Test
	void rejectsMismatchedCategoryAndSlot() throws Exception {
		mvc.perform(auth(get("/api/v1/shop").param("itemCategory", "AVATAR").param("slotType", "FLOOR")))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMMON_001"));
		mvc.perform(auth(get("/api/v1/shop").param("itemCategory", "FURNITURE").param("slotType", "HEAD")))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMMON_001"));
	}

	@Test
	void purchasesBothCategoriesSameDayWithoutEquippingOrPlacing() throws Exception {
		seedBalance(100);
		long avatar = createItem("AVATAR", "HEAD", 30, true);
		long furniture = createItem("FURNITURE", "FLOOR", 70, true);
		purchase(avatar).andExpect(status().isOk())
				.andExpect(jsonPath("$.data.userItemId").isNumber())
				.andExpect(jsonPath("$.data.userFurnitureId").value(nullValue()))
				.andExpect(jsonPath("$.data.itemCategory").value("AVATAR"))
				.andExpect(jsonPath("$.data.price").value(30)).andExpect(jsonPath("$.data.balance").value(70));
		purchase(furniture).andExpect(status().isOk())
				.andExpect(jsonPath("$.data.userFurnitureId").isNumber())
				.andExpect(jsonPath("$.data.userItemId").value(nullValue()))
				.andExpect(jsonPath("$.data.itemCategory").value("FURNITURE"))
				.andExpect(jsonPath("$.data.balance").value(0));
		assertThat(count("SELECT COUNT(*) FROM user_items WHERE user_id = :id AND equipped_slot IS NULL")).isEqualTo(1);
		assertThat(count("SELECT COUNT(*) FROM user_furnitures WHERE user_id = :id AND placement_status IS NULL AND placement_direction IS NULL AND position_x IS NULL AND position_y IS NULL AND layer = 0")).isEqualTo(1);
		List<FinCoin> ledger = coins.findByUserIdOrderByIdDesc(userId, org.springframework.data.domain.Limit.unlimited());
		assertThat(ledger).extracting(FinCoin::getDelta).containsExactly(-70, -30, 100);
		assertThat(ledger).extracting(FinCoin::getBalanceAfter).containsExactly(0, 70, 100);
		assertThat(ledger.getFirst().getReasonCode()).isEqualTo(FinCoinReason.PURCHASE);
		assertThat(ledger.getFirst().getGrantDate()).isEqualTo(PURCHASE_DATE);
		assertThat(ledger.getFirst().getRefId()).isEqualTo(Long.toString(furniture));
		assertThat(ledger.getFirst().getCreatedAt()).isNotNull();
		mvc.perform(auth(get("/api/v1/fin-coins/balance"))).andExpect(status().isOk())
				.andExpect(jsonPath("$.data.balance").value(0));
		mvc.perform(auth(get("/api/v1/fin-coins"))).andExpect(status().isOk())
				.andExpect(jsonPath("$.data.items[0].delta").value(-70));
	}

	@Test
	void freePurchaseCreatesZeroLedgerWithoutPriorCoins() throws Exception {
		long item = createItem("FURNITURE", "WALL", 0, true);
		purchase(item).andExpect(status().isOk()).andExpect(jsonPath("$.data.price").value(0))
				.andExpect(jsonPath("$.data.balance").value(0));
		assertThat(balance()).isZero();
		assertThat(coins.findFirstByUserIdOrderByIdDesc(userId).orElseThrow().getDelta()).isZero();
		assertThat(purchaseCount()).isEqualTo(1);
	}

	@Test
	void usesServerPriceAndPrincipalInsteadOfClientValues() throws Exception {
		seedBalance(50);
		long item = createItem("AVATAR", "HEAD", 30, true);
		long other = createUser();
		mvc.perform(auth(post("/api/v1/shop/purchase")).contentType(APPLICATION_JSON)
				.content("{\"itemId\":" + item + ",\"price\":0,\"userId\":" + other + "}"))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data.price").value(30))
				.andExpect(jsonPath("$.data.balance").value(20));
		assertThat(coins.findFirstByUserIdOrderByIdDesc(other)).isEmpty();
	}

	@Test
	void failedPurchasesLeaveBothInventoryAndLedgerUnchanged() throws Exception {
		seedBalance(20);
		long costly = createItem("AVATAR", "FACE", 21, true);
		long inactive = createItem("FURNITURE", "WALL", 10, false);
		long negative = createItem("AVATAR", "HEAD", -1, true);
		purchase(costly).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SHOP_003"));
		purchase(inactive).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("SHOP_001"));
		purchase(Long.MAX_VALUE).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("SHOP_001"));
		purchase(negative).andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("SHOP_004"));
		assertThat(purchaseCount()).isZero();
		assertThat(inventoryCount()).isZero();
		assertThat(balance()).isEqualTo(20);
	}

	@Test
	void rejectsRepeatedPurchasesForBothCategoriesWithoutAdditionalCharge() throws Exception {
		seedBalance(20);
		for (long item : List.of(createItem("AVATAR", "HEAD", 10, true), createItem("FURNITURE", "FLOOR", 10, true))) {
			purchase(item).andExpect(status().isOk());
			purchase(item).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SHOP_002"));
		}
		assertThat(balance()).isZero();
		assertThat(purchaseCount()).isEqualTo(2);
		assertThat(inventoryCount()).isEqualTo(2);
	}

	@ParameterizedTest
	@ValueSource(strings = {"{}", "{\"itemId\":null}", "{\"itemId\":0}", "{\"itemId\":-1}"})
	void rejectsInvalidItemId(String body) throws Exception {
		mvc.perform(auth(post("/api/v1/shop/purchase")).contentType(APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMMON_001"));
		assertThat(purchaseCount()).isZero();
	}

	@ParameterizedTest
	@ValueSource(strings = {"", "null", "{", "{\"itemId\":[]}", "{\"itemId\":9223372036854775808}"})
	void rejectsUnreadableBody(String body) throws Exception {
		mvc.perform(auth(post("/api/v1/shop/purchase")).contentType(APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMMON_002"));
	}

	@Test
	void requiresAuthenticationAndAnActiveUser() throws Exception {
		mvc.perform(get("/api/v1/shop")).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/v1/shop/purchase").contentType(APPLICATION_JSON).content("{\"itemId\":1}"))
				.andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/shop").header("Authorization", "Bearer invalid"))
				.andExpect(status().isUnauthorized());
		jdbc.sql("UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = :id").param("id", userId).update();
		assertUserNotFound();
		users.deleteById(userId);
		assertUserNotFound();
	}

	@Test
	void concurrentSameItemPurchasesChargeOnlyOnce() throws Exception {
		seedBalance(100);
		long item = createItem("AVATAR", "HEAD", 30, true);
		assertThat(runConcurrently(List.of(() -> purchaseStatus(item), () -> purchaseStatus(item))))
				.containsExactlyInAnyOrder(200, 409);
		assertThat(balance()).isEqualTo(70);
		assertThat(purchaseCount()).isEqualTo(1);
		assertThat(inventoryCount()).isEqualTo(1);
	}

	@Test
	void concurrentDifferentItemsCannotOverspend() throws Exception {
		seedBalance(100);
		long avatar = createItem("AVATAR", "HEAD", 70, true);
		long furniture = createItem("FURNITURE", "FLOOR", 70, true);
		assertThat(runConcurrently(List.of(() -> purchaseStatus(avatar), () -> purchaseStatus(furniture))))
				.containsExactlyInAnyOrder(200, 409);
		assertThat(balance()).isEqualTo(30);
		assertThat(purchaseCount()).isEqualTo(1);
		assertThat(inventoryCount()).isEqualTo(1);
	}

	@Test
	void concurrentAttendanceAndPurchasePreserveBothChanges() throws Exception {
		seedBalance(100);
		long item = createItem("FURNITURE", "WALL", 70, true);
		assertThat(runConcurrently(List.of(() -> purchaseStatus(item), () -> finCoinService.checkAttendance(userId).granted())))
				.containsExactlyInAnyOrder(200, 10);
		assertThat(balance()).isEqualTo(40);
		assertThat(purchaseCount()).isEqualTo(1);
		assertThat(finCoinService.checkAttendance(userId).granted()).isZero();
	}

	@ParameterizedTest
	@ValueSource(strings = {"AVATAR", "FURNITURE"})
	void transactionFailureRollsBackInventoryAndCoins(String category) {
		seedBalance(100);
		long item = createItem(category, category.equals("AVATAR") ? "HEAD" : "FLOOR", 30, true);
		assertThatThrownBy(() -> new TransactionTemplate(transactions).executeWithoutResult(status -> {
			shop.purchase(userId, item);
			assertThat(purchaseCount()).isEqualTo(1);
			assertThat(inventoryCount()).isEqualTo(1);
			throw new IllegalStateException("failure before commit");
		})).isInstanceOf(IllegalStateException.class).hasMessage("failure before commit");
		assertThat(balance()).isEqualTo(100);
		assertThat(purchaseCount()).isZero();
		assertThat(inventoryCount()).isZero();
		assertThat(shop.purchase(userId, item).balance()).isEqualTo(70);
	}

	@Test
	void documentsFiltersPurchaseFieldsAndErrors() throws Exception {
		String get = "$.paths['/api/v1/shop'].get";
		String post = "$.paths['/api/v1/shop/purchase'].post";
		mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
				.andExpect(jsonPath(get + ".parameters[*].name").value(containsInAnyOrder("itemCategory", "slotType")))
				.andExpect(jsonPath(get + ".security[0].bearerAuth").exists())
				.andExpect(jsonPath(post + ".security[0].bearerAuth").exists())
				.andExpect(jsonPath(post + ".requestBody.required").value(true))
				.andExpect(jsonPath(post + ".responses['200'].content['application/json'].schema['$ref']").value("#/components/schemas/BaseResponseShopPurchaseResponse"))
				.andExpect(jsonPath(post + ".responses['409']").exists())
				.andExpect(jsonPath(post + ".responses['500']").exists())
				.andExpect(jsonPath("$.components.schemas.ShopPurchaseRequest.required").value(contains("itemId")))
				.andExpect(jsonPath("$.components.schemas.ShopPurchaseRequest.properties").value(aMapWithSize(1)))
				.andExpect(jsonPath("$.components.schemas.ShopPurchaseResponse.required").value(containsInAnyOrder("itemId", "itemCategory", "userItemId", "userFurnitureId", "price", "balance")))
				.andExpect(jsonPath("$.components.schemas.ShopPurchaseResponse.properties.userItemId.type").value(containsInAnyOrder("integer", "null")))
				.andExpect(jsonPath("$.components.schemas.ShopItemResponse.properties").value(aMapWithSize(8)));
	}

	private void assertUserNotFound() throws Exception {
		mvc.perform(auth(get("/api/v1/shop"))).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("USER_001"));
		purchase(1).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("USER_001"));
	}

	private long createUser() {
		long id = users.save(User.create("shop-" + UUID.randomUUID() + "@test.io", "encoded", "상점테스터")).getId();
		userIds.add(id);
		return id;
	}

	private long createItem(String category, String slot, int price, boolean active) {
		String asset = "shop_" + UUID.randomUUID();
		jdbc.sql("INSERT INTO items (item_category, slot_type, name, price, asset_key, is_active) VALUES (:category, :slot, '테스트 상품', :price, :asset, :active)")
				.param("category", category).param("slot", slot).param("price", price).param("asset", asset).param("active", active).update();
		long id = jdbc.sql("SELECT id FROM items WHERE asset_key = :asset").param("asset", asset).query(Long.class).single();
		itemIds.add(id);
		return id;
	}

	private void seedBalance(int balance) {
		jdbc.sql("INSERT INTO fin_coin (user_id, delta, balance_after, reason_code, grant_date) VALUES (:id, :balance, :balance, 'MONTHLY', '2026-09-01')")
				.param("id", userId).param("balance", balance).update();
	}

	private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request) {
		return request.header("Authorization", "Bearer " + tokens.generateAccessToken(userId));
	}

	private ResultActions purchase(long itemId) throws Exception {
		return mvc.perform(auth(post("/api/v1/shop/purchase")).contentType(APPLICATION_JSON).content("{\"itemId\":" + itemId + "}"));
	}

	private int purchaseStatus(long itemId) throws Exception {
		return purchase(itemId).andReturn().getResponse().getStatus();
	}

	private int balance() {
		return coins.findFirstByUserIdOrderByIdDesc(userId).map(FinCoin::getBalanceAfter).orElse(0);
	}

	private long count(String sql) {
		return jdbc.sql(sql).param("id", userId).query(Long.class).single();
	}

	private long purchaseCount() {
		return count("SELECT COUNT(*) FROM fin_coin WHERE user_id = :id AND reason_code = 'PURCHASE'");
	}

	private long inventoryCount() {
		return count("SELECT COUNT(*) FROM user_items WHERE user_id = :id") + count("SELECT COUNT(*) FROM user_furnitures WHERE user_id = :id");
	}

	private List<Integer> runConcurrently(List<Callable<Integer>> jobs) throws Exception {
		var ready = new CountDownLatch(jobs.size());
		var start = new CountDownLatch(1);
		try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
			var futures = jobs.stream().map(job -> executor.submit(() -> {
				ready.countDown();
				if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("start timeout");
				return job.call();
			})).toList();
			try {
				assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
			} finally {
				start.countDown();
			}
			List<Integer> results = new ArrayList<>();
			for (var future : futures) results.add(future.get(30, TimeUnit.SECONDS));
			return results;
		}
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class TimeConfig {
		@Bean
		@Primary
		Clock shopTestClock() {
			// UTC 날짜와 한국 날짜가 다른 시점으로 원장의 한국 날짜 저장도 검증한다.
			return Clock.fixed(Instant.parse("2026-09-17T15:01:00Z"), ZoneOffset.UTC);
		}
	}
}
