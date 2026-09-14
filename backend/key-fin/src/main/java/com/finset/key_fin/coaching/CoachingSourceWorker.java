package com.finset.key_fin.coaching;

import com.finset.key_fin.global.exception.BusinessException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/** Runs independently of source commits. Failed or interrupted work stays available for replay. */
@Component
@ConditionalOnProperty(prefix = "coaching", name = "source-sync-enabled", havingValue = "true")
public class CoachingSourceWorker {
    private final CoachingSourceOutbox outbox;
    private final CoachingSourceAdapter adapter;

    public CoachingSourceWorker(CoachingSourceOutbox outbox, CoachingSourceAdapter adapter) {
        this.outbox = outbox;
        this.adapter = adapter;
    }

    @Scheduled(fixedDelayString = "${coaching.source-sync-delay-ms:30000}")
    public void tick() {
        var pending = outbox.claim(Instant.now());
        if (pending.isEmpty()) {
            return;
        }
        var job = pending.get();
        try {
            var result = adapter.synchronize(job.userId(), LocalDate.now(ZoneId.of("Asia/Seoul")), "sync-" + job.leaseToken());
            if ("blocked".equals(result.status())) {
                outbox.retry(job, result.reason(), Instant.now());
            } else if ("pending".equals(result.status())) {
                outbox.resume(job);
            } else {
                outbox.complete(job);
            }
        } catch (BusinessException exception) {
            outbox.retry(job, exception.getErrorCode().getCode(), Instant.now());
        } catch (RuntimeException exception) {
            // Do not persist provider responses, SQL payloads or credentials in retry diagnostics.
            outbox.retry(job, "SOURCE_SYNC_FAILURE", Instant.now());
        }
    }
    @Configuration
    @EnableScheduling
    @ConditionalOnProperty(prefix = "coaching", name = "source-sync-enabled", havingValue = "true")
    static class Scheduling { }
}
