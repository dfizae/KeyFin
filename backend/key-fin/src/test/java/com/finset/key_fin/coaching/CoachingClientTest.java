package com.finset.key_fin.coaching;

import com.finset.key_fin.global.exception.BusinessException;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class CoachingClientTest {
    private HttpServer server;
    private CoachingProperties properties;
    private final AtomicReference<String> authorization = new AtomicReference<>();
    private final AtomicReference<String> body = new AtomicReference<>();

    @BeforeEach
    void setUp() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/sessions", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = "{\"id\":\"session-a\",\"coaching_id\":null,\"messages\":[]}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
        properties = new CoachingProperties();
        properties.setEnabled(true);
        properties.setBaseUrl(URI.create("http://127.0.0.1:" + server.getAddress().getPort()));
        properties.setUserTokens(Map.of(1L, "test-owner-one", 2L, "test-owner-two"));
    }

    @AfterEach
    void tearDown() { server.stop(0); }

    @Test
    void selectsCredentialFromAuthenticatedOwnerWhenCreatingEmptySession() {
        // Given: two independently mapped principals and a real HTTP receiver.
        CoachingClient client = new CoachingClient(properties, JsonMapper.builder().build());
        // When: the second principal starts a general conversation.
        var result = client.post(2L, "/v1/sessions", "new-session", Map.of());
        // Then: only that owner's credential crosses the server-to-server boundary.
        assertEquals("Bearer test-owner-two", authorization.get());
        assertEquals("{}", body.get());
        assertEquals("session-a", result.get("id").asString());
    }

    @Test
    void rejectsUnmappedOwnerBeforeNetworkAccess() {
        CoachingClient client = new CoachingClient(properties, JsonMapper.builder().build());
        assertThrows(BusinessException.class, () -> client.post(9L, "/v1/sessions", "key", Map.of()));
        assertNull(authorization.get());
    }

    @Test
    void refusesSharedTokensWhenEnabled() {
        properties.setUserTokens(Map.of(1L, "shared-token", 2L, "shared-token"));
        assertThrows(IllegalArgumentException.class,
                () -> new CoachingClient(properties, JsonMapper.builder().build()));
    }

    @Test
    void staysExplicitlyUnavailableWhenDisabled() {
        properties.setEnabled(false);
        CoachingClient client = new CoachingClient(properties, JsonMapper.builder().build());
        assertThrows(BusinessException.class, () -> client.get(1L, "/v1/sessions/example"));
        assertNull(authorization.get());
    }

    @Test
    void rejectsMalformedSuccessBodyWithoutReturningUpstreamText() {
        server.createContext("/v1/broken", exchange -> {
            byte[] response = "private upstream text".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response); exchange.close();
        });
        var failure = assertThrows(BusinessException.class,
                () -> new CoachingClient(properties, JsonMapper.builder().build()).get(1L, "/v1/broken"));
        assertEquals(CoachingErrorCode.UPSTREAM, failure.getErrorCode());
        assertFalse(failure.getMessage().contains("private"));
    }

    @Test
    void enforcesDeadlineEvenWhenHeadersArriveBeforeTheBody() {
        properties.setTimeout(Duration.ofMillis(150));
        server.createContext("/v1/slow", exchange -> {
            exchange.sendResponseHeaders(200, 0);
            exchange.getResponseBody().flush();
            try { Thread.sleep(500); }
            catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); }
            exchange.close();
        });
        var failure = assertThrows(BusinessException.class,
                () -> new CoachingClient(properties, JsonMapper.builder().build()).get(1L, "/v1/slow"));
        assertEquals(CoachingErrorCode.TIMEOUT, failure.getErrorCode());
    }

    @Test
    void writeBridgeRequiresItsOwnCredential() {
        var client = new CoachingClient(properties, JsonMapper.builder().build());
        var failure = assertThrows(BusinessException.class, () -> client.postBackend(1L, "/v1/personal/context", "sync", Map.of()));
        assertEquals(CoachingErrorCode.UNAVAILABLE, failure.getErrorCode());
        assertNull(authorization.get());
    }

    @Test
    void notificationRoleIsSeparateFromChatAndSelectedForTheAuthenticatedOwner() {
        properties.setNotificationTokens(Map.of(1L, "notify-owner-one", 2L, "notify-owner-two"));
        server.createContext("/v1/notifications", exchange -> {
            String header = exchange.getRequestHeaders().getFirst("Authorization");
            authorization.set(header);
            boolean allowed = "Bearer notify-owner-two".equals(header);
            byte[] response = (allowed ? "{\"items\":[]}" : "{\"code\":\"notification_role_required\"}").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(allowed ? 200 : 403, response.length);
            exchange.getResponseBody().write(response); exchange.close();
        });
        var client = new CoachingClient(properties, JsonMapper.builder().build());
        assertEquals("session-a", client.post(2L, "/v1/sessions", "session", Map.of()).get("id").asString());
        assertEquals("Bearer test-owner-two", authorization.get());
        assertThrows(BusinessException.class, () -> client.get(2L, "/v1/notifications"));
        assertEquals("Bearer test-owner-two", authorization.get());
        assertTrue(client.notifications(2L).get("items").isArray());
        assertEquals("Bearer notify-owner-two", authorization.get());
    }

    @Test
    void missingNotificationCredentialDoesNotFallBackToReadOrWriteCredentials() {
        properties.setBackendTokens(Map.of(1L, "owner-one-write"));
        var client = new CoachingClient(properties, JsonMapper.builder().build());
        assertEquals(CoachingErrorCode.UNAVAILABLE,
                assertThrows(BusinessException.class, () -> client.notifications(1L)).getErrorCode());
        assertNull(authorization.get());
    }
}
