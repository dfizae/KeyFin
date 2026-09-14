package com.finset.key_fin.coaching;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import tools.jackson.databind.JsonNode;

import java.util.HashSet;
import java.util.List;

/**
 * The Python Bootstrap/EventRequest envelopes. Inner FDT documents stay lossless and are validated
 * by the canonical engine. This is not a guessed mapping from card settlement or account entities.
 */
public final class EngineInput {
    private EngineInput() { }

    public record Envelope(String envelope, @JsonProperty("balance_krw") long balanceKrw) {
        public Envelope {
            if (envelope == null || envelope.isEmpty() || envelope.length() > 40
                    || balanceKrw < -1_000_000_000_000L || balanceKrw > 1_000_000_000_000L) {
                throw new IllegalArgumentException("Invalid envelope name or integer KRW balance");
            }
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Bootstrap(@JsonProperty("as_of") String asOf, List<JsonNode> transactions,
                            JsonNode snapshot, List<Envelope> envelopes) {
        public Bootstrap {
            PersonalContextInput.date(asOf);
            transactions = List.copyOf(transactions);
            envelopes = List.copyOf(envelopes);
            if (transactions.isEmpty() || transactions.size() > 10_000 || envelopes.size() > 7) {
                throw new IllegalArgumentException("Bootstrap requires 1..10000 transactions and at most seven envelopes");
            }
            transactions.forEach(EngineInput::document);
            if (snapshot != null) document(snapshot);
            if (new HashSet<>(envelopes.stream().map(Envelope::envelope).toList()).size() != envelopes.size()) {
                throw new IllegalArgumentException("Envelope names must be unique");
            }
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Event(@JsonProperty("expected_revision") long expectedRevision, JsonNode event,
                        @JsonProperty("cancellation_balance") Envelope cancellationBalance,
                        @JsonProperty("snapshot_event") JsonNode snapshotEvent) {
        public Event {
            if (expectedRevision < 0) throw new IllegalArgumentException("Expected revision must be nonnegative");
            document(event);
            if (snapshotEvent != null) document(snapshotEvent);
        }
    }
    private static void document(JsonNode value) {
        if (value == null || !value.isObject()) throw new IllegalArgumentException("A canonical FDT JSON object is required");
    }
}
