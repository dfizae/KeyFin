package com.finset.key_fin.coaching;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;

/**
 * Exact server-to-server replacement contract for facts outside the FDT snapshot.
 * All amounts are whole KRW. Unknown coverage cannot silently become a confirmed zero.
 * The caller derives the owner from its authenticated/domain context, never this payload.
 */
public record PersonalContextInput(
        @JsonProperty("expected_revision") long expectedRevision,
        @JsonProperty("as_of") String asOf,
        String currency,
        @JsonProperty("source_system") String sourceSystem,
        @JsonProperty("source_record_id") String sourceRecordId,
        Provenance provenance,
        Section<Insurance> insurance,
        Section<Monthly> income,
        @JsonProperty("fixed_costs") Section<Monthly> fixedCosts,
        Section<Goal> goals) {
    public PersonalContextInput {
        if (expectedRevision < 0) throw new IllegalArgumentException("Expected revision must be nonnegative");
        date(asOf);
        if (!"KRW".equals(currency)) throw new IllegalArgumentException("Only integer KRW is supported");
        identifier(sourceSystem); identifier(sourceRecordId);
        Objects.requireNonNull(provenance); Objects.requireNonNull(insurance); Objects.requireNonNull(income);
        Objects.requireNonNull(fixedCosts); Objects.requireNonNull(goals);
    }

    public enum Coverage { complete, partial, unknown }
    public enum Provenance { connected_backend, user_declared, synthetic }
    public interface Item { String id(); String label(); }

    public record Section<T extends Item>(Coverage coverage, List<T> items) {
        public Section {
            Objects.requireNonNull(coverage);
            items = List.copyOf(items);
            if (items.size() > 100 || (coverage == Coverage.unknown && !items.isEmpty())) {
                throw new IllegalArgumentException("Unknown sections must be empty; at most 100 facts per section");
            }
            if (new HashSet<>(items.stream().map(Item::id).toList()).size() != items.size()) {
                throw new IllegalArgumentException("Fact IDs must be unique within a section");
            }
        }
        public static <T extends Item> Section<T> unknown() { return new Section<>(Coverage.unknown, List.of()); }
    }

    public record Monthly(String id, String label, @JsonProperty("monthly_amount_krw") long monthlyAmountKrw) implements Item {
        public Monthly { item(id, label); money(monthlyAmountKrw); }
    }
    public record Insurance(String id, String label, @JsonProperty("monthly_premium_krw") long monthlyPremiumKrw,
            @JsonProperty("coverage_amount_krw") Long coverageAmountKrw) implements Item {
        public Insurance { item(id, label); money(monthlyPremiumKrw); if (coverageAmountKrw != null) money(coverageAmountKrw); }
    }
    public record Goal(String id, String label, @JsonProperty("target_krw") long targetKrw,
            @JsonProperty("saved_krw") long savedKrw, @JsonProperty("target_date") String targetDate) implements Item {
        public Goal {
            item(id, label); money(targetKrw); money(savedKrw);
            if (targetKrw == 0) throw new IllegalArgumentException("Goal target must be positive");
            if (targetDate != null) date(targetDate);
        }
    }

    private static void item(String id, String label) {
        identifier(id);
        if (label == null || label.isEmpty() || label.length() > 80 || !label.matches("[^\\x00-\\x1f<>]+")) {
            throw new IllegalArgumentException("Invalid fact label");
        }
    }
    private static void identifier(String value) {
        if (value == null || !value.matches("[A-Za-z0-9_.-]{1,120}")) throw new IllegalArgumentException("Invalid source identifier");
    }
    private static void money(long value) {
        if (value < 0 || value > 1_000_000_000_000L) throw new IllegalArgumentException("Amount must be integer KRW between zero and one trillion");
    }
    static void date(String value) {
        if (value == null || !value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw new IllegalArgumentException("Expected YYYY-MM-DD");
        LocalDate.parse(value);
    }
}
