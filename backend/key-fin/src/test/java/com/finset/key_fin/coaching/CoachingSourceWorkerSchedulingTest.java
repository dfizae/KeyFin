package com.finset.key_fin.coaching;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Exercise Spring's actual scheduled entry point; never call tick directly in this test. */
class CoachingSourceWorkerSchedulingTest {
    @Test void springSchedulerDrainsQueuedOwnersSequentiallyAndClosesCleanly() throws Exception {
        var database = new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL", "sa", "");
        try (var connection = database.getConnection(); var context = new AnnotationConfigApplicationContext()) {
            var jdbc = JdbcClient.create(database);
            jdbc.sql(Files.readString(Path.of("src/main/resources/db/migration/V8__coaching_source_outbox.sql"))).update();
            var properties = new CoachingProperties();
            properties.setSourceSyncEnabled(true);
            var outbox = new CoachingSourceOutbox(jdbc, properties);
            var adapter = mock(CoachingSourceAdapter.class);
            var applied = new CountDownLatch(60);
            var concurrentCalls = new AtomicInteger();
            var maximumConcurrentCalls = new AtomicInteger();
            when(adapter.synchronize(anyLong(), any(), anyString())).thenAnswer(invocation -> {
                maximumConcurrentCalls.accumulateAndGet(concurrentCalls.incrementAndGet(), Math::max);
                try {
                    assertFalse(Thread.currentThread().getName().equals("Test worker"));
                    applied.countDown();
                    return new CoachingSourceAdapter.SyncResult("synchronized", 1, null, false);
                } finally { concurrentCalls.decrementAndGet(); }
            });
            context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("synthetic-test", Map.of(
                    "coaching.source-sync-enabled", "true", "coaching.source-sync-delay-ms", "25")));
            context.registerBean(CoachingProperties.class, () -> properties);
            context.registerBean(CoachingSourceOutbox.class, () -> outbox);
            context.registerBean(CoachingSourceAdapter.class, () -> adapter);
            context.register(CoachingSourceWorker.class, CoachingSourceWorker.Scheduling.class);
            context.refresh();
            // Source signals arrive after startup, as they do from committed transaction callbacks.
            for (int owner = 1; owner <= 60; owner++) {
                jdbc.sql("INSERT INTO coaching_source_outbox(user_id,generation,available_at) VALUES(:owner,1,CURRENT_TIMESTAMP)")
                        .param("owner", owner).update();
            }
            assertTrue(applied.await(10, TimeUnit.SECONDS), "Spring must actually trigger and drain source jobs");
            // Last adapter return precedes its durable completion; wait for the DB, not just the latch.
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
            int completed;
            do {
                completed = jdbc.sql("SELECT COUNT(*) FROM coaching_source_outbox WHERE generation=completed_generation")
                        .query(Integer.class).single();
                if (completed < 60) Thread.sleep(10);
            } while (completed < 60 && System.nanoTime() < deadline);
            assertEquals(60, completed);
            assertEquals(1, maximumConcurrentCalls.get(), "Batching must not introduce parallel adapter calls");
            for (long owner = 1; owner <= 60; owner++)
                verify(adapter, times(1)).synchronize(eq(owner), any(), anyString());
            assertFalse(connection.isClosed());
        }
    }
}
