package com.finset.key_fin.notification;

import com.finset.key_fin.notification.dto.request.PushDeviceRequest;
import com.finset.key_fin.notification.repository.PushDeviceRepository;
import com.finset.key_fin.notification.service.PushDeviceService;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.MySQLContainer;
import java.time.*;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

/** Default: disposable MySQL Testcontainer. Override only with a dedicated empty test schema. */
class PushDeviceIntegrationTest {
    static MySQLContainer<?> mysql;
    static JdbcClient jdbc;
    static PushDeviceService service;
    static final Clock CLOCK = Clock.fixed(Instant.parse("2026-09-16T00:00:00Z"), ZoneId.of("Asia/Seoul"));
    UUID installation;

    @BeforeAll static void database() {
        String url = System.getenv("PUSH_TEST_MYSQL_URL");
        String username;
        String password;
        if (url == null) {
            mysql = new MySQLContainer<>("mysql:8.0.46");
            mysql.start();
            url = mysql.getJdbcUrl();
            username = mysql.getUsername();
            password = mysql.getPassword();
        } else {
            if (!url.matches("jdbc:mysql://[^/]+/push_test_[a-zA-Z0-9_]+(\\?.*)?"))
                throw new IllegalArgumentException("PUSH_TEST_MYSQL_URL must use a dedicated push_test_* schema");
            username = System.getenv().getOrDefault("PUSH_TEST_MYSQL_USER", "root");
            password = System.getenv().getOrDefault("PUSH_TEST_MYSQL_PASSWORD", "");
        }
        var source = new DriverManagerDataSource(url, username, password);
        Flyway.configure().dataSource(source).load().migrate();
        jdbc = JdbcClient.create(source);
        service = new PushDeviceService(new PushDeviceRepository(jdbc), CLOCK, new DataSourceTransactionManager(source));
        jdbc.sql("INSERT INTO users (id,email,password,name) VALUES (901,'push-a@test.invalid','test','A'),(902,'push-b@test.invalid','test','B')").update();
    }

    @AfterAll static void stop() { if (mysql != null) mysql.stop(); }
    @BeforeEach void reset() {
        jdbc.sql("DELETE FROM push_devices").update();
        installation = UUID.randomUUID();
    }
    void register(long user, UUID id, String token) { service.register(user, id, new PushDeviceRequest(token, "ANDROID")); }
    long count() { return jdbc.sql("SELECT COUNT(*) FROM push_devices").query(Long.class).single(); }

    @Test void repeatedRegistrationAndRotationReuseRowWithKstClock() {
        register(901, installation, "first");
        long id = service.findActive(901).getFirst().id();
        register(901, installation, "first");
        register(901, installation, "rotated");
        assertThat(count()).isEqualTo(1);
        var device = service.findActive(901).getFirst();
        assertThat(device.id()).isEqualTo(id);
        assertThat(device.fcmToken()).isEqualTo("rotated");
        assertThat(device.lastSeenAt()).isEqualTo(LocalDateTime.of(2026,9,16,9,0));
    }

    @Test void ownershipChangesAndLatePreviousOwnerDeleteDoesNothing() {
        register(901, installation, "token");
        register(902, installation, "token");
        service.disconnect(901, installation);
        assertThat(service.findActive(901)).isEmpty();
        assertThat(service.findActive(902)).hasSize(1);
        assertThat(count()).isEqualTo(1);
        service.disconnect(902, installation);
        service.disconnect(902, installation);
        service.disconnect(902, UUID.randomUUID());
        assertThat(service.findActive(902)).isEmpty();
        assertThat(jdbc.sql("SELECT COUNT(*) FROM push_devices WHERE fcm_token IS NULL").query(Long.class).single()).isEqualTo(1);
        register(901, installation, "new");
        assertThat(count()).isEqualTo(1);
    }

    @Test void multipleDevicesCaseSensitiveTokensAndMaximumLengthAreSupported() {
        register(901, installation, "Case");
        register(901, UUID.randomUUID(), "case");
        register(901, UUID.randomUUID(), "x".repeat(2048));
        assertThat(service.findActive(901)).hasSize(3);
    }

    @Test void duplicateTokenIsReleasedBeforeReassignmentAndNullsAreNotUnique() {
        UUID second = UUID.randomUUID();
        UUID third = UUID.randomUUID();
        register(901, installation, "shared");
        register(902, second, "shared");
        register(901, third, "shared");
        assertThat(count()).isEqualTo(3);
        assertThat(service.findActive(901)).hasSize(1);
        assertThat(service.findActive(902)).isEmpty();
        assertThat(jdbc.sql("SELECT COUNT(*) FROM push_devices WHERE active = FALSE AND fcm_token IS NULL")
                .query(Long.class).single()).isEqualTo(2);
    }

    @Test void concurrentSameInstallationNeverCreatesDuplicates() throws Exception {
        concurrent(() -> register(901, installation, "one"), () -> register(902, installation, "two"));
        assertThat(count()).isEqualTo(1);
        assertThat(service.findActive(901).size() + service.findActive(902).size()).isEqualTo(1);
    }

    @Test void concurrentSameTokenHasExactlyOneActiveOwner() throws Exception {
        concurrent(() -> register(901, installation, "same"), () -> register(902, UUID.randomUUID(), "same"));
        assertThat(service.findActive(901).size() + service.findActive(902).size()).isEqualTo(1);
        assertThat(jdbc.sql("SELECT COUNT(*) FROM push_devices WHERE fcm_token='same'").query(Long.class).single()).isEqualTo(1);
    }

    @Test void deletedUsersCannotRegisterOrReceive() {
        register(901, installation, "token");
        jdbc.sql("UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id=901").update();
        try {
            assertThat(service.findActive(901)).isEmpty();
            assertThatThrownBy(() -> register(901, installation, "other")).isInstanceOf(com.finset.key_fin.global.exception.BusinessException.class);
        } finally {
            jdbc.sql("UPDATE users SET deleted_at = NULL WHERE id=901").update();
        }
    }

    private void concurrent(Runnable first, Runnable second) throws Exception {
        var start = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<?> a = executor.submit(() -> { await(start); first.run(); });
            Future<?> b = executor.submit(() -> { await(start); second.run(); });
            a.get(20, TimeUnit.SECONDS);
            b.get(20, TimeUnit.SECONDS);
        }
    }
    private static void await(CyclicBarrier barrier) {
        try { barrier.await(5, TimeUnit.SECONDS); }
        catch (Exception e) { throw new RuntimeException(e); }
    }
}
