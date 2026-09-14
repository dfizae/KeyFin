package com.finset.key_fin.coaching;

import com.finset.key_fin.global.exception.BusinessException;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/** Real JDBC queries and real outbound HTTP. The fixture contains only synthetic source records. */
class CoachingSourceAdapterTest {
    private static final LocalDate CUTOFF = LocalDate.of(2026, 9, 3);
    private final JsonMapper mapper = JsonMapper.builder().build();
    private final AtomicReference<JsonNode> sent = new AtomicReference<>();
    private HttpServer server;
    private JdbcClient jdbc;
    private CoachingSourceAdapter adapter;
    private CoachingSourceRepository repository;
    private CoachingProperties properties;

    @BeforeEach void setUp() throws Exception {
        var database = new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = JdbcClient.create(database);
        // Column names/types match the V1 projection; optional entity-era anchor is exercised separately.
        for (var ddl : List.of(
                "CREATE TABLE accounts(id BIGINT PRIMARY KEY,user_id BIGINT)",
                "CREATE TABLE cards(id BIGINT PRIMARY KEY,user_id BIGINT)",
                "CREATE TABLE envelopes(id INT PRIMARY KEY,name VARCHAR(30))",
                "CREATE TABLE subcategories(id INT PRIMARY KEY,envelope_id INT,name VARCHAR(30))",
                "CREATE TABLE user_settings(user_id BIGINT PRIMARY KEY)",
                "CREATE TABLE budgets(id BIGINT PRIMARY KEY,user_id BIGINT,budget_month CHAR(6),status VARCHAR(20))",
                "CREATE TABLE budget_envelopes(id BIGINT PRIMARY KEY,budget_id BIGINT,envelope_id INT,confirmed_amount BIGINT)",
                """
                CREATE TABLE transactions(id BIGINT PRIMARY KEY,user_id BIGINT,source VARCHAR(10),tx_type VARCHAR(20),
                  account_id BIGINT,card_id BIGINT,merchant_id BIGINT,merchant_name_raw VARCHAR(100),amount BIGINT,
                  tx_date DATE,tx_time TIME,subcategory_id INT,confirm_status VARCHAR(20),exclude_tag VARCHAR(20),
                  adjusted_amount BIGINT,status VARCHAR(20))
                """)) jdbc.sql(ddl).update();
        jdbc.sql("INSERT INTO accounts VALUES(10,1),(20,2)").update();
        jdbc.sql("INSERT INTO cards VALUES(30,1),(40,2)").update();
        var names = List.of("외식", "교통비", "의료·건강", "취미·여가", "쇼핑", "편의점·마트·잡화", "기타");
        jdbc.sql("INSERT INTO budgets VALUES(1,1,'202609','CONFIRMED'),(2,2,'202609','CONFIRMED')").update();
        for (int i=1; i<=7; i++) {
            jdbc.sql("INSERT INTO envelopes VALUES(?,?)").params(i,names.get(i-1)).update();
            jdbc.sql("INSERT INTO budget_envelopes VALUES(?,1,?,100000)").params(i,i).update();
        }
        jdbc.sql("INSERT INTO subcategories VALUES(101,1,'음식점'),(602,6,'마트'),(703,7,'경조사·기타')").update();
        row(1, 1, "2026-09-01", 10000, "NORMAL");
        row(2, 2, "2026-09-02", 99000, "NORMAL");
        row(3, 1, "2026-09-04", 50000, "NORMAL");
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/", exchange -> {
            sent.set(mapper.readTree(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)));
            byte[] response = "{\"revision\":1}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200,response.length); exchange.getResponseBody().write(response); exchange.close();
        }); server.start();
        properties = new CoachingProperties(); properties.setEnabled(true);
        properties.setBaseUrl(URI.create("http://127.0.0.1:" + server.getAddress().getPort()));
        properties.setBackendTokens(Map.of(1L,"synthetic-write-one")); properties.setOwnerIds(Map.of(1L,"source-one"));
        repository = new CoachingSourceRepository(jdbc,database);
        adapter = new CoachingSourceAdapter(repository,new CoachingDataBridge(new CoachingClient(properties,mapper)),mapper,properties);
    }
    @AfterEach void stop() { server.stop(0); jdbc.sql("DROP ALL OBJECTS").update(); }
    CoachingSourceAdapter sourceAdapter() { return adapter; }
    CoachingClient sourceClient() { return new CoachingClient(properties,mapper); }
    void useUpstream(String origin, String writeToken, String userToken) {
        properties.setBaseUrl(URI.create(origin)); properties.setBackendTokens(Map.of(1L,writeToken));
        properties.setUserTokens(Map.of(1L,userToken));
        adapter = new CoachingSourceAdapter(repository,new CoachingDataBridge(sourceClient()),mapper,properties);
    }
    void commitPayment() { row(4,1,"2026-09-03",60000,"NORMAL"); }
    void cancelPayment() { jdbc.sql("UPDATE transactions SET status='CANCELED' WHERE id=4").update(); }

    private void row(long id, long user, String date, long amount, String status) {
        jdbc.sql("""
                INSERT INTO transactions VALUES(:id,:userId,'LIVE','WITHDRAW',:accountId,NULL,NULL,'합성 가맹점',
                  :amount,:date,'12:00:00',101,'CONFIRMED','NONE',NULL,:status)
                """).param("id",id).param("userId",user).param("accountId",user==1?10:20)
                .param("amount",amount).param("date",LocalDate.parse(date)).param("status",status).update();
    }

    @Test void bootstrapsOnlyOwnedPastRowsAndSubtractsSpendingOnce() throws Exception {
        var result = adapter.bootstrap(1L,CUTOFF,"source-bootstrap");
        assertTrue(result.readiness().canSyncHistory()); assertFalse(result.readiness().cashForecastReady());
        assertEquals(1,result.readiness().excludedFutureRows());
        assertEquals(1,sent.get().get("transactions").size());
        assertEquals("source-one",sent.get().get("transactions").get(0).get("user_id").asString());
        assertEquals(90000,sent.get().get("envelopes").get(0).get("balance_krw").asLong());
        assertFalse(sent.get().has("snapshot"));
        capture("source-bootstrap.json",sent.get());
    }
    @Test void excludesLeapDayFutureRowsWithoutAssumingThirtyDayMonths() {
        row(5,1,"2024-02-29",500,"NORMAL"); row(6,1,"2024-03-01",700,"NORMAL");
        var data=repository.read(1,LocalDate.of(2024,2,29));
        assertEquals(List.of(5L),data.rows().stream().map(CoachingSourceRepository.Row::id).toList());
    }
    @Test void usesPersistedBudgetAnchorInsteadOfCalendarMonthWhenAvailable() {
        jdbc.sql("ALTER TABLE user_settings ADD budget_anchor_day INT").update();
        jdbc.sql("INSERT INTO user_settings VALUES(1,25)").update();
        jdbc.sql("UPDATE budgets SET budget_month='202608' WHERE id=1").update();
        row(7,1,"2026-08-24",6000,"NORMAL"); row(8,1,"2026-08-25",2000,"NORMAL");
        assertEquals(12000,repository.read(1,CUTOFF).budgets().get(0).spent());
    }
    @Test void blocksDutchAndRestoreWithoutSendingAFilteredSubset() {
        jdbc.sql("UPDATE transactions SET exclude_tag='DUTCH',adjusted_amount=4000 WHERE id=1").update();
        var result=adapter.bootstrap(1L,CUTOFF,"blocked");
        assertNull(result.upstream()); assertNull(sent.get());
        assertEquals(List.of(new CoachingSourceAdapter.Issue("unsupported_budget_adjustment",1)),result.readiness().issues());
        jdbc.sql("UPDATE transactions SET exclude_tag='RESTORE',adjusted_amount=NULL WHERE id=1").update();
        assertFalse(adapter.readiness(1L,CUTOFF).canSyncHistory());
    }
    @Test void blocksForeignAssetReferenceAndUnconfiguredOwner() {
        jdbc.sql("UPDATE transactions SET account_id=20 WHERE id=1").update();
        assertTrue(adapter.readiness(1L,CUTOFF).issues().contains(new CoachingSourceAdapter.Issue("asset_owner_mismatch",1)));
        assertThrows(BusinessException.class,()->adapter.bootstrap(2L,CUTOFF,"wrong-owner")); assertNull(sent.get());
    }
    @Test void translatesOnlyTheSupermarketAliasAndPreservesOriginalLabels() throws Exception {
        jdbc.sql("UPDATE transactions SET subcategory_id=602 WHERE id=1").update();
        adapter.bootstrap(1L,CUTOFF,"groceries");
        var transaction=sent.get().get("transactions").get(0);
        assertEquals("장보기",transaction.get("subcategory").asString());
        assertEquals("마트",transaction.get("source_subcategory").asString());
        assertEquals("편의점·마트·잡화",transaction.get("source_category").asString());
        capture("source-supermarket.json",sent.get());
    }
    @Test void leavesPendingAndSelfTransferOutOfEnvelopeSpending() {
        jdbc.sql("UPDATE transactions SET confirm_status='PENDING',subcategory_id=NULL WHERE id=1").update();
        adapter.bootstrap(1L,CUTOFF,"pending");
        assertEquals(100000,sent.get().get("envelopes").get(0).get("balance_krw").asLong());
        jdbc.sql("UPDATE transactions SET confirm_status='CONFIRMED',exclude_tag='SELF_TRANSFER',tx_type='TRANSFER' WHERE id=1").update();
        adapter.bootstrap(1L,CUTOFF,"transfer");
        assertEquals("SELF_TRANSFER",sent.get().get("transactions").get(0).get("exclude_tag").asString());
        assertEquals(100000,sent.get().get("envelopes").get(0).get("balance_krw").asLong());
    }
    @Test void rejectsMissingBudgetsAndFutureDate() {
        assertThrows(BusinessException.class,()->adapter.readiness(1L,LocalDate.of(2999,1,1)));
        jdbc.sql("UPDATE budget_envelopes SET confirmed_amount=NULL WHERE id=1").update();
        assertFalse(adapter.readiness(1L,CUTOFF).canSyncHistory()); assertNull(sent.get());
    }
    @Test void blocksDepositOrTransferClassifiedAsEnvelopeSpending() {
        for(var type : List.of("DEPOSIT","TRANSFER")) {
            jdbc.sql("UPDATE transactions SET tx_type=? WHERE id=1").param(type).update();
            var result=adapter.bootstrap(1L,CUTOFF,"bad-direction");
            assertNull(result.upstream());
            assertTrue(result.readiness().issues().contains(new CoachingSourceAdapter.Issue("non_expense_budget_classification",1)));
        }
        assertNull(sent.get());
    }
    @Test void reportsUnsupportedEnumsBeforeMakingAnyWrite() {
        jdbc.sql("UPDATE transactions SET source='UNKNOWN' WHERE id=1").update();
        assertTrue(adapter.readiness(1L,CUTOFF).issues().contains(new CoachingSourceAdapter.Issue("unsupported_source_enum",1)));
        assertNull(adapter.bootstrap(1L,CUTOFF,"unknown-source").upstream()); assertNull(sent.get());
    }
    private void capture(String name,JsonNode value) throws Exception {
        String directory=System.getenv("COACHING_SOURCE_CAPTURE_DIR");
        if (directory!=null) { Files.createDirectories(Path.of(directory)); Files.writeString(Path.of(directory,name),mapper.writeValueAsString(value)); }
    }
}
