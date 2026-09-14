package com.finset.key_fin.coaching;

import com.finset.key_fin.global.exception.BusinessException;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

/**
 * Converts stored facts, never caller-supplied financial JSON. Unsupported accounting semantics
 * block the whole write, so dropping a refund or adjusting a purchase cannot create false accuracy.
 * Snapshot remains absent: V1 has no observed balances and V5 values are intraday observations.
 */
@Service
public class CoachingSourceAdapter {
    // FDT mapping.py category fallback is explicit. Preserve the product's original subcategory.
    private static final Map<String, String> CATEGORY = Map.of("외식", "식비", "교통비", "교통",
            "의료·건강", "건강", "취미·여가", "여가·문화", "쇼핑", "쇼핑",
            "편의점·마트·잡화", "편의점·마트·잡화", "기타", "교육");
    private final CoachingSourceRepository source;
    private final CoachingDataBridge bridge;
    private final JsonMapper mapper;
    private final Map<Long, String> owners;

    public CoachingSourceAdapter(CoachingSourceRepository source, CoachingDataBridge bridge,
                                 JsonMapper mapper, CoachingProperties properties) {
        this.source = source;
        this.bridge = bridge;
        this.mapper = mapper;
        this.owners = Map.copyOf(properties.getOwnerIds());
        if (new HashSet<>(owners.values()).size() != owners.size() || owners.entrySet().stream().anyMatch(entry ->
                entry.getKey() <= 0 || !entry.getValue().matches("[A-Za-z0-9_.-]{1,120}"))) {
            throw new IllegalArgumentException("Source owners must be unique IDs matching Python backend credentials");
        }
        if (properties.isSourceSyncEnabled() && (!properties.isEnabled() || owners.isEmpty()
                || !properties.getBackendTokens().keySet().containsAll(owners.keySet()))) {
            throw new IllegalArgumentException("Source sync requires configured owner/backend credentials");
        }
    }

    public record Issue(String code, long count) { }
    public record Readiness(String asOf, int transactionCount, long excludedFutureRows,
                            boolean canSyncHistory, boolean cashForecastReady, List<Issue> issues) { }
    public record Result(Readiness readiness, JsonNode upstream) { }
    public record SyncResult(String status, int appliedEvents, String reason, boolean cashForecastReady) { }

    /** Reconcile latest committed rows. New payments precede cancellations so balance replacement
     * cannot include a payment that the service would subsequently debit for the first time. */
    public SyncResult synchronize(Long userId, LocalDate asOf, String operationKey) {
        String owner = owner(userId);
        validDate(asOf);
        var data = source.read(userId, asOf);
        var readiness = inspect(data, asOf);
        if (!readiness.canSyncHistory()) {
            return blocked(readiness.issues().getFirst().code());
        }
        JsonNode before;
        try {
            before = bridge.currentTwin(userId);
        } catch (BusinessException exception) {
            if (exception.getErrorCode() != CoachingErrorCode.NOT_FOUND) {
                throw exception;
            }
            var initialized = bootstrap(userId, asOf, operationKey);
            return initialized.upstream() == null ? blocked("source_changed_during_initialization")
                    : new SyncResult("initialized", 0, null, false);
        }
        var engineDate = LocalDate.parse(before.get("as_of").asString());
        if (engineDate.isAfter(asOf)) {
            return blocked("stale_source_cutoff");
        }
        if (!before.path("transactions").isArray() || before.path("transactions").isEmpty()) {
            return blocked("source_baseline_missing");
        }
        var existing = new java.util.HashMap<String, JsonNode>();
        for (var item : before.get("transactions")) {
            existing.put(item.get("id").asString(), item);
        }
        var baseline = before.get("transactions").get(0).get("raw");
        if (!data.period().from().toString().equals(baseline.path("source_budget_period_start").asString(""))) {
            return blocked("budget_period_requires_reconciliation");
        }
        if (!budgetDigest(data).equals(baseline.path("source_budget_digest").asString(""))) {
            return blocked("budget_plan_requires_reconciliation");
        }
        var changes = new ArrayList<CoachingSourceRepository.Row>();
        for (var row : data.rows()) {
            var old = existing.get(Long.toString(row.id()));
            if (old != null && sameRaw(old.get("raw"), transaction(owner, row, data))) {
                continue;
            }
            if (!"LIVE".equals(row.source())) {
                return blocked("seed_event_not_allowed");
            }
            if (old != null) {
                var raw = old.get("raw");
                for (var key : List.of("amount_krw", "account_id", "card_id", "merchant_id", "transaction_type", "transaction_date", "transaction_time")) {
                    if (!text(raw.path(key)).equals(text(transaction(owner, row, data).path(key)))) {
                        return blocked("immutable_transaction_changed");
                    }
                }
                if (!old.get("active").asBoolean() && "NORMAL".equals(row.status())) {
                    return blocked("canceled_transaction_restored");
                }
                if (old.get("budget_amount_krw").asLong() > 0 && "NORMAL".equals(row.status())) {
                    return blocked("reclassification_requires_ledger_reconciliation");
                }
                if ("CANCELED".equals(row.status()) && !old.path("envelope").isNull()
                        && !old.path("envelope").asString().equals(row.envelope())) {
                    return blocked("cancellation_category_changed");
                }
            }
            if ("NORMAL".equals(row.status()) && row.date().isBefore(data.period().from())) {
                return blocked("historical_event_requires_reconciliation");
            }
            changes.add(row);
        }
        // Existing rows falling outside this bounded history are retained by the engine. Physical
        // deletions within its active period are not silently interpreted as cancellations.
        var ids = data.rows().stream().map(row -> Long.toString(row.id())).collect(java.util.stream.Collectors.toSet());
        for (var old : existing.values()) {
            if (!ids.contains(old.get("id").asString())
                    && !LocalDate.parse(old.get("date").asString()).isBefore(asOf.minusDays(364))) {
                return blocked("source_transaction_deleted");
            }
        }
        changes.sort(java.util.Comparator.comparing(row -> "CANCELED".equals(row.status())));
        // The engine can advance its date through a real transaction or authoritative snapshot,
        // not a fabricated clock event. Never report an old baseline as synchronized to today.
        if (engineDate.isBefore(asOf) && changes.stream().noneMatch(row ->
                "NORMAL".equals(row.status()) && row.date().equals(asOf))) {
            return blocked("stale_engine_cutoff");
        }
        long revision = before.get("revision").asLong();
        // One mutation keeps the GET + POST bounded by the worker's five-minute lease. The next
        // tick compares source state again, so retries never replay an already observed debit.
        for (var row : changes.stream().limit(1).toList()) {
            var raw = transaction(owner, row, data);
            String key = "source-" + digest(mapper.writeValueAsString(raw) + ":" + revision);
            var event = mapper.createObjectNode().put("event_id", key).put("user_id", owner);
            EngineInput.Envelope balance = null;
            if ("CANCELED".equals(row.status()) && existing.containsKey(Long.toString(row.id()))) {
                event.put("type", "cancel_transaction").put("transaction_id", Long.toString(row.id()));
                var budget = data.budgets().stream().filter(b -> b.name().equals(row.envelope())).findFirst();
                if (budget.isPresent()) {
                    balance = new EngineInput.Envelope(budget.get().name(),
                            Math.subtractExact(budget.get().confirmedAmount(), budget.get().spent()));
                }
            } else {
                event.put("type", "transaction").set("transaction", raw);
            }
            var applied = bridge.applyEvent(userId, key, new EngineInput.Event(revision, event, balance, null));
            revision = applied.get("identity").get("revision").asLong();
        }
        return new SyncResult(changes.isEmpty() ? "unchanged" : changes.size() > 1 ? "pending" : "synchronized",
                Math.min(changes.size(), 1), null, false);
    }

    private static SyncResult blocked(String reason) {
        return new SyncResult("blocked", 0, reason, false);
    }
    private static boolean sameRaw(JsonNode old, JsonNode fresh) {
        for (var entry : fresh.properties()) {
            if (!text(old.path(entry.getKey())).equals(text(entry.getValue()))) {
                return false;
            }
        }
        return true;
    }
    private static String text(JsonNode value) {
        return value.isString() ? value.asString() : value.toString();
    }

    public Readiness readiness(Long userId, LocalDate asOf) {
        owner(userId);
        validDate(asOf);
        return inspect(source.read(userId, asOf), asOf);
    }

    public Result bootstrap(Long userId, LocalDate asOf, String key) {
        String owner = owner(userId);
        validDate(asOf);
        var data = source.read(userId, asOf);
        var readiness = inspect(data, asOf);
        if (!readiness.canSyncHistory()) {
            return new Result(readiness, null);
        }
        var rows = data.rows().stream().map(row -> transaction(owner, row, data)).toList();
        var balances = data.budgets().stream().map(b -> new EngineInput.Envelope(b.name(),
                Math.subtractExact(b.confirmedAmount(), b.spent()))).toList();
        return new Result(readiness, bridge.bootstrap(userId, key,
                new EngineInput.Bootstrap(asOf.toString(), rows, null, balances)));
    }

    private Readiness inspect(CoachingSourceRepository.Source data, LocalDate asOf) {
        var codes = new ArrayList<String>();
        if (data.rows().isEmpty()) {
            codes.add("no_transactions");
        }
        if (data.rows().size() > 10000) {
            codes.add("transaction_limit");
        }
        if (data.budgets().size() != 7 || data.budgets().stream().anyMatch(b -> b.confirmedAmount() == null
                || !CATEGORY.containsKey(b.name()))) {
            codes.add("seven_confirmed_envelopes_required");
        }
        for (var row : data.rows()) {
            if (row.amount() < 0 || row.amount() > 1_000_000_000_000L) {
                codes.add("amount_out_of_range");
            }
            if ((row.accountId() != null && !row.accountOwned()) || (row.cardId() != null && !row.cardOwned())) {
                codes.add("asset_owner_mismatch");
            }
            if (row.accountId() == null && row.cardId() == null) {
                codes.add("asset_reference_missing");
            }
            if (row.cardId() != null && row.merchantId() == null) {
                codes.add("merchant_reference_missing");
            }
            if ("DUTCH".equals(row.excluded()) || "RESTORE".equals(row.excluded()) || row.adjustedAmount() != null) {
                codes.add("unsupported_budget_adjustment");
            }
            if (!"DEPOSIT".equals(row.type()) && !"TRANSFER".equals(row.type()) && !"PENDING".equals(row.confirmed())
                    && "NONE".equals(row.excluded()) && row.envelope() == null) {
                codes.add("confirmed_category_missing");
            }
            if (!List.of("CARD", "DEPOSIT", "WITHDRAW", "TRANSFER").contains(row.type())) {
                codes.add("unsupported_transaction_type");
            }
            if (!List.of("SEED", "LIVE").contains(row.source())
                    || !List.of("AUTO", "PENDING", "CONFIRMED").contains(row.confirmed())
                    || !List.of("NORMAL", "CANCELED").contains(row.status())
                    || !List.of("NONE", "DUTCH", "RESTORE", "SELF_TRANSFER", "EMERGENCY", "CARRYOVER").contains(row.excluded())) {
                codes.add("unsupported_source_enum");
            }
            // Product SQL would count a classified deposit/transfer, whereas the FDT correctly
            // treats its direction as non-spending. Require the source to resolve this conflict.
            if (List.of("DEPOSIT", "TRANSFER").contains(row.type()) && row.envelope() != null
                    && "NORMAL".equals(row.status()) && !"PENDING".equals(row.confirmed())
                    && "NONE".equals(row.excluded())) {
                codes.add("non_expense_budget_classification");
            }
        }
        var counts = new java.util.TreeMap<String, Long>();
        codes.forEach(code -> counts.merge(code, 1L, Long::sum));
        var issues = counts.entrySet().stream().map(entry -> new Issue(entry.getKey(), entry.getValue())).toList();
        return new Readiness(asOf.toString(), data.rows().size(), data.futureRows(), issues.isEmpty(), false, issues);
    }

    private JsonNode transaction(String owner, CoachingSourceRepository.Row row, CoachingSourceRepository.Source data) {
        var result = mapper.createObjectNode().put("user_id", owner).put("transaction_id", Long.toString(row.id()))
                .put("source", row.source()).put("transaction_type", row.type()).put("transaction_date", row.date().toString())
                .put("transaction_time", row.time().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss")))
                .put("category", row.envelope() == null ? "" : CATEGORY.getOrDefault(row.envelope(), ""))
                // The sole alias translates the same canonical supermarket category; it does not
                // narrow a broad category into a guessed action. Original labels remain in raw.
                .put("subcategory", "마트".equals(row.subcategory()) ? "장보기" : row.subcategory() == null ? "" : row.subcategory())
                .put("source_category", row.envelope() == null ? "" : row.envelope())
                .put("source_subcategory", row.subcategory() == null ? "" : row.subcategory())
                .put("source_mapping_version", "keyfin-db-to-fdt/1")
                .put("source_budget_period_start", data.period().from().toString())
                .put("source_budget_period_end_exclusive", data.period().to().toString())
                .put("source_budget_digest", budgetDigest(data))
                .put("merchant", row.merchant() == null ? "" : row.merchant()).put("merchant_id", id(row.merchantId()))
                .put("amount_krw", row.amount()).put("account_id", id(row.accountId())).put("card_id", id(row.cardId()))
                .put("confirm_status", row.confirmed()).put("status", row.status()).put("exclude_tag", row.excluded());
        return result;
    }
    private String budgetDigest(CoachingSourceRepository.Source data) {
        return digest(mapper.writeValueAsString(data.budgets().stream()
                .map(b -> Map.of("envelope", b.name(), "confirmed", b.confirmedAmount())).toList()));
    }
    private static String digest(String value) {
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static String id(Long id) {
        return id == null ? "" : id.toString();
    }

    private String owner(Long userId) {
        if (userId == null) {
            throw new BusinessException(CoachingErrorCode.UNAUTHENTICATED);
        }
        if (!owners.containsKey(userId)) {
            throw new BusinessException(CoachingErrorCode.UNAVAILABLE);
        }
        return owners.get(userId);
    }
    private static void validDate(LocalDate asOf) {
        if (asOf == null || asOf.isAfter(LocalDate.now(ZoneId.of("Asia/Seoul")))) {
            throw new BusinessException(CoachingErrorCode.INVALID_REQUEST);
        }
    }
}
