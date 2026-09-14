package com.finset.key_fin.coaching;

import com.finset.key_fin.global.exception.GlobalExceptionHandler;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

/** MVC + actual HTTP transport against a bounded wire fixture, not an inference accuracy test. */
class CoachingControllerTest {
    private HttpServer server;
    private MockMvc mvc;
    private final AtomicReference<String> token = new AtomicReference<>();
    private final AtomicReference<String> payload = new AtomicReference<>();
    private final AtomicReference<String> key = new AtomicReference<>();
    private final AtomicReference<String> reply = new AtomicReference<>();

    @BeforeEach
    void setUp() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        reply.set("{\"id\":\"session-1\",\"messages\":[]}");
        server.createContext("/v1/", exchange -> {
            token.set(exchange.getRequestHeaders().getFirst("Authorization"));
            key.set(exchange.getRequestHeaders().getFirst("Idempotency-Key"));
            payload.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] bytes = reply.get().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        CoachingProperties properties = new CoachingProperties();
        properties.setEnabled(true);
        properties.setBaseUrl(URI.create("http://127.0.0.1:" + server.getAddress().getPort()));
        properties.setUserTokens(Map.of(7L, "only-seven"));
        properties.setNotificationTokens(Map.of(7L, "notify-seven"));
        CoachingClient client = new CoachingClient(properties, JsonMapper.builder().build());
        mvc = standaloneSetup(new CoachingController(client)).setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(7L, null, List.of()));
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
        SecurityContextHolder.clearContext();
    }

    @Test
    void opensEmptySessionWhenNoPriorCoachingExists() throws Exception {
        // Given: an authenticated app principal with no coaching ID.
        // When: the app starts a conversation.
        mvc.perform(post("/api/v1/coaching/sessions").header("Idempotency-Key", "session-attempt")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value("session-1"));
        // Then: the backend's owner credential and original request key reach the AI API.
        assertEquals("Bearer only-seven", token.get());
        assertEquals("session-attempt", key.get());
        assertEquals("{}", payload.get());
    }

    @Test
    void preservesChatAnswerVariantWhenSendingFinancialQuestion() throws Exception {
        reply.set("{\"id\":\"answer-1\",\"answer_type\":\"finance_education\",\"status\":\"needs_source\",\"text\":\"자료 필요\"}");
        mvc.perform(post("/api/v1/coaching/sessions/session-1/messages").header("Idempotency-Key", "turn-attempt")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"question\":\"금융 질문\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.answer_type").value("finance_education"))
                .andExpect(jsonPath("$.data.status").value("needs_source"));
        assertEquals("{\"question\":\"금융 질문\"}", payload.get());
    }

    @Test
    void preservesReceiptAndDatesWhenPredictionArrives() throws Exception {
        reply.set("{\"id\":\"forecast-1\",\"text\":\"예측\",\"receipt\":{\"period\":{\"window_end\":\"2026-09-30\"},\"numeric_result\":{\"balance\":12345}}}");
        mvc.perform(get("/api/v1/coaching/records/forecast-1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.receipt.period.window_end").value("2026-09-30"))
                .andExpect(jsonPath("$.data.receipt.numeric_result.balance").value(12345));
    }

    @Test
    void refusesUnauthenticatedAccessBeforeContactingAi() throws Exception {
        SecurityContextHolder.clearContext();
        mvc.perform(get("/api/v1/coaching/sessions/session-1"))
                .andExpect(status().isUnauthorized());
        assertNull(token.get());
    }

    @Test
    void refusesEmptyQuestionBeforeContactingAi() throws Exception {
        mvc.perform(post("/api/v1/coaching/questions").header("Idempotency-Key", "key")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"question\":\" \"}"))
                .andExpect(status().isBadRequest());
        assertNull(token.get());
    }

    @Test
    void acknowledgesNotificationWithAuthenticatedOwnerAndIdempotencyKey() throws Exception {
        reply.set("{\"event_id\":\"event-1\",\"acknowledged\":true}");
        mvc.perform(post("/api/v1/coaching/notifications/event-1/ack").header("Idempotency-Key", "ack-1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.acknowledged").value(true));
        assertEquals("Bearer notify-seven", token.get());
        assertEquals("ack-1", key.get());
    }

    @Test
    void listsNotificationsWithOwnerNotificationRoleRatherThanChatRole() throws Exception {
        reply.set("{\"items\":[]}");
        mvc.perform(get("/api/v1/coaching/notifications")).andExpect(status().isOk());
        assertEquals("Bearer notify-seven", token.get());
    }
}
