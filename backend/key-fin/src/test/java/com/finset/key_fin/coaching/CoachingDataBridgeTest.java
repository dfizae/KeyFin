package com.finset.key_fin.coaching;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static com.finset.key_fin.coaching.PersonalContextInput.*;
import static org.junit.jupiter.api.Assertions.*;

class CoachingDataBridgeTest {
    @Test
    void sendsSourceStampedIntegerKrwFactsWithOwnerWriteToken() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var authorization = new AtomicReference<String>();
        var body = new AtomicReference<String>();
        server.createContext("/v1/personal/context", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = "{\"revision\":1}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response); exchange.close();
        });
        server.start();
        try {
            var properties = new CoachingProperties();
            properties.setEnabled(true);
            properties.setBaseUrl(URI.create("http://127.0.0.1:" + server.getAddress().getPort()));
            properties.setUserTokens(Map.of(2L, "owner-two-read"));
            properties.setBackendTokens(Map.of(2L, "owner-two-write"));
            var mapper = JsonMapper.builder().build();
            var bridge = new CoachingDataBridge(new CoachingClient(properties, mapper));
            var input = new PersonalContextInput(0, "2028-02-29", "KRW", "test-backend", "snapshot-1", Provenance.synthetic,
                    Section.unknown(), new Section<>(Coverage.partial, List.of(new Monthly("salary", "월 소득", 3_500_000))),
                    Section.unknown(), Section.unknown());
            assertEquals(1, bridge.replacePersonalContext(2L, "sync-1", input).get("revision").asInt());
            var sent = mapper.readTree(body.get());
            assertEquals("Bearer owner-two-write", authorization.get());
            assertEquals(3_500_000, sent.get("income").get("items").get(0).get("monthly_amount_krw").asLong());
            assertEquals("unknown", sent.get("fixed_costs").get("coverage").asString());
            assertEquals("2028-02-29", sent.get("as_of").asString());
            assertFalse(sent.has("user_id"));
        } finally { server.stop(0); }
    }

    @Test
    void rejectsUnknownNonemptySectionsAndDuplicateFactIds() {
        var salary = new Monthly("salary", "월 소득", 100);
        assertThrows(IllegalArgumentException.class, () -> new Section<>(Coverage.unknown, List.of(salary)));
        assertThrows(IllegalArgumentException.class, () -> new Section<>(Coverage.complete, List.of(salary, salary)));
        assertThrows(IllegalArgumentException.class, () -> new Monthly("salary", "월 소득", -1));
        assertThrows(java.time.DateTimeException.class,
                () -> new Goal("goal", "목표", 100, 0, "2027-02-29"));
    }

    @Test
    void preservesCanonicalEngineDocumentsWithoutInferringCardSettlement() {
        var mapper = JsonMapper.builder().build();
        var original = mapper.readTree("{\"event_id\":\"source-1\",\"amount_krw\":50000,\"source_kind\":\"CARD_PAYMENT\"}");
        var event = new EngineInput.Event(7, original, null, null);
        var transmitted = mapper.readTree(mapper.writeValueAsString(event));
        assertEquals(original, transmitted.get("event"));
        assertEquals(7, transmitted.get("expected_revision").asInt());
        assertFalse(transmitted.has("snapshot_event"));
        assertThrows(IllegalArgumentException.class, () -> new EngineInput.Bootstrap("2026-09-03", List.of(), null, List.of()));
        assertThrows(IllegalArgumentException.class, () -> new EngineInput.Event(-1, original, null, null));
    }
}
