package com.finset.key_fin.coaching;

import com.finset.key_fin.global.exception.BusinessException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.function.LongSupplier;

/** Runs independently of source commits. Failed or interrupted work stays available for replay. */
@Component
@ConditionalOnProperty(prefix = "coaching", name = "source-sync-enabled", havingValue = "true")
public class CoachingSourceWorker {
    private final CoachingSourceOutbox outbox;
    private final CoachingSourceAdapter adapter;
    private final int maxJobs;
    private final long timeBudgetNanos;
    private final Clock clock;
    private final LongSupplier nanoTime;

    @Autowired
    public CoachingSourceWorker(CoachingSourceOutbox outbox, CoachingSourceAdapter adapter,
                                CoachingProperties properties) {
        this(outbox, adapter, properties, Clock.systemUTC(), System::nanoTime);
    }

    /** Independent clocks keep elapsed-time limits immune to wall-clock/NTP corrections. */
    CoachingSourceWorker(CoachingSourceOutbox outbox, CoachingSourceAdapter adapter,
                         CoachingProperties properties, Clock clock, LongSupplier nanoTime) {
        var budget = properties.getSourceSyncTimeBudget();
        if (properties.getSourceSyncMaxJobsPerTick() < 1 || properties.getSourceSyncMaxJobsPerTick() > 100
                || budget == null || budget.compareTo(Duration.ofSeconds(1)) < 0
                || budget.compareTo(Duration.ofSeconds(60)) > 0) {
            throw new IllegalArgumentException("Source sync requires 1..100 jobs and a 1..60 second time budget");
        }
        this.outbox = outbox;
        this.adapter = adapter;
        this.maxJobs = properties.getSourceSyncMaxJobsPerTick();
        this.timeBudgetNanos = budget.toNanos();
        this.clock = clock.withZone(ZoneId.of("Asia/Seoul"));
        this.nanoTime = nanoTime;
    }

    @Scheduled(fixedDelayString = "${coaching.source-sync-delay-ms:30000}")
    public void tick() {
        long started = nanoTime.getAsLong();
        for (int count = 0; count < maxJobs; count++) {
            if (Thread.currentThread().isInterrupted() || nanoTime.getAsLong() - started >= timeBudgetNanos) {
                return;
            }
            var pending = outbox.claim(clock.instant());
            if (pending.isEmpty()) {
                return;
            }
            if (Thread.currentThread().isInterrupted() || nanoTime.getAsLong() - started >= timeBudgetNanos) {
                // A slow DB claim may consume the budget before the first HTTP call begins.
                outbox.resume(pending.get(), clock.instant());
                return;
            }
            // Claim only just before use; never hold a batch of leases while waiting for HTTP.
            synchronize(pending.get());
        }
    }

    private void synchronize(CoachingSourceOutbox.Job job) {
        try {
            var result = adapter.synchronize(job.userId(), LocalDate.now(clock), "sync-" + job.leaseToken());
            if (result == null || result.status() == null) {
                outbox.retry(job, "SOURCE_SYNC_INVALID_RESULT", clock.instant());
                return;
            }
            switch (result.status()) {
                case "blocked" -> outbox.retry(job, result.reason(), clock.instant());
                case "pending" -> outbox.resume(job, clock.instant());
                case "initialized", "unchanged", "synchronized" -> outbox.complete(job);
                // Future adapter states are not evidence of completion until explicitly supported.
                default -> outbox.retry(job, "SOURCE_SYNC_INVALID_RESULT", clock.instant());
            }
        } catch (BusinessException exception) {
            outbox.retry(job, exception.getErrorCode().getCode(), clock.instant());
        } catch (RuntimeException exception) {
            // Do not persist provider responses, SQL payloads or credentials in retry diagnostics.
            outbox.retry(job, "SOURCE_SYNC_FAILURE", clock.instant());
        }
    }
    @Configuration
    @EnableScheduling
    @ConditionalOnProperty(prefix = "coaching", name = "source-sync-enabled", havingValue = "true")
    static class Scheduling { }
}
