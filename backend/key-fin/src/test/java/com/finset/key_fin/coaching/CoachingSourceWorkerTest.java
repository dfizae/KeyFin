package com.finset.key_fin.coaching;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Real durable queue; adapter responses are controlled, so this does not measure model latency. */
class CoachingSourceWorkerTest {
    private JdbcClient jdbc;
    private CoachingSourceOutbox outbox;
    private CoachingSourceAdapter adapter;
    private java.sql.Connection connection;

    @BeforeEach void start() throws Exception {
        var database = new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL", "sa", "");
        // Keep a dedicated connection alive until cleanup, avoiding leaked in-memory databases.
        connection = database.getConnection();
        jdbc = JdbcClient.create(database);
        jdbc.sql(Files.readString(Path.of("src/main/resources/db/migration/V8__coaching_source_outbox.sql"))).update();
        outbox = new CoachingSourceOutbox(jdbc, new CoachingProperties());
        adapter = mock(CoachingSourceAdapter.class);
        when(adapter.synchronize(anyLong(), any(), anyString()))
                .thenReturn(new CoachingSourceAdapter.SyncResult("synchronized", 1, null, false));
    }

    @AfterEach void stop() throws Exception { if (connection != null) connection.close(); }

    private void queue(long owner) {
        jdbc.sql("INSERT INTO coaching_source_outbox(user_id,generation,available_at) VALUES(:owner,1,:at)")
                .param("owner", owner).param("at", java.sql.Timestamp.from(Instant.now().minusSeconds(60))).update();
    }

    private int completed() {
        return jdbc.sql("SELECT COUNT(*) FROM coaching_source_outbox WHERE generation=completed_generation")
                .query(Integer.class).single();
    }

    @Test void oneTickDrainsTwentyReadyOwnersInsteadOfOnlyOne() {
        for (int owner = 1; owner <= 60; owner++) queue(owner);
        new CoachingSourceWorker(outbox, adapter, new CoachingProperties()).tick();
        assertEquals(20, completed(), "A default tick should drain a bounded batch of 20 ready owners");
    }

    @Test void unknownAdapterStatusMustNotAcknowledgeSourceWork() {
        queue(1);
        when(adapter.synchronize(anyLong(), any(), anyString()))
                .thenReturn(new CoachingSourceAdapter.SyncResult("unknown", 0, null, false));
        new CoachingSourceWorker(outbox, adapter, new CoachingProperties()).tick();
        assertEquals(0, completed(), "An unrecognized status is not proof that source data reached the FDT");
        assertEquals("SOURCE_SYNC_INVALID_RESULT", jdbc.sql("SELECT last_error_code FROM coaching_source_outbox")
                .query(String.class).single());
    }

    @ParameterizedTest
    @ValueSource(strings = {"initialized", "unchanged", "synchronized"})
    void onlyDocumentedSuccessStatesAcknowledgeWork(String status) {
        queue(1);
        when(adapter.synchronize(anyLong(), any(), anyString()))
                .thenReturn(new CoachingSourceAdapter.SyncResult(status, 0, null, false));
        new CoachingSourceWorker(outbox, adapter, new CoachingProperties()).tick();
        assertEquals(1, completed());
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "success", "SYNCHRONIZED"})
    void malformedStatusesRemainAvailableForRetry(String status) {
        queue(1);
        when(adapter.synchronize(anyLong(), any(), anyString()))
                .thenReturn(new CoachingSourceAdapter.SyncResult(status, 0, null, false));
        new CoachingSourceWorker(outbox, adapter, new CoachingProperties()).tick();
        assertEquals(0, completed());
        assertEquals("SOURCE_SYNC_INVALID_RESULT", jdbc.sql("SELECT last_error_code FROM coaching_source_outbox")
                .query(String.class).single());
        verify(adapter, times(1)).synchronize(anyLong(), any(), anyString());
    }

    @Test void nullResultDoesNotAcknowledgeWork() {
        queue(1);
        when(adapter.synchronize(anyLong(), any(), anyString())).thenReturn(null);
        new CoachingSourceWorker(outbox, adapter, new CoachingProperties()).tick();
        assertEquals(0, completed());
        assertEquals("SOURCE_SYNC_INVALID_RESULT", jdbc.sql("SELECT last_error_code FROM coaching_source_outbox")
                .query(String.class).single());
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 20})
    void sixtyReadyOwnersNeedSixtyOrThreeTicksWithIdenticalResponses(int batchSize) {
        for (int owner = 1; owner <= 60; owner++) queue(owner);
        var properties = new CoachingProperties();
        properties.setSourceSyncMaxJobsPerTick(batchSize);
        // Freeze elapsed time to measure queue scheduling only, not machine/HTTP speed.
        var worker = new CoachingSourceWorker(outbox, adapter, properties, Clock.systemUTC(), () -> 0L);
        int ticks = 0;
        while (completed() < 60 && ticks < 61) { worker.tick(); ticks++; }
        assertEquals(60 / batchSize, ticks);
        assertEquals(60, completed());
        for (long owner = 1; owner <= 60; owner++)
            verify(adapter, times(1)).synchronize(eq(owner), any(), anyString());
        System.out.printf("QUEUE_TICKS owners=60 maxJobs=%d ticks=%d completed=%d%n", batchSize, ticks, completed());
    }

    @Test void pendingOwnerCanProgressWithinOneTickButCannotExceedItsJobLimit() {
        queue(1);
        when(adapter.synchronize(anyLong(), any(), anyString()))
                .thenReturn(new CoachingSourceAdapter.SyncResult("pending", 1, null, false));
        new CoachingSourceWorker(outbox, adapter, new CoachingProperties()).tick();
        assertEquals(0, completed());
        assertEquals(0, jdbc.sql("SELECT COUNT(*) FROM coaching_source_outbox WHERE lease_token IS NOT NULL")
                .query(Integer.class).single());
        verify(adapter, times(20)).synchronize(eq(1L), any(), anyString());
    }

    @Test void pendingWorkFinishesOnItsLastEventWithoutAnotherSchedulerDelay() {
        queue(1);
        when(adapter.synchronize(anyLong(), any(), anyString()))
                .thenReturn(new CoachingSourceAdapter.SyncResult("pending", 1, null, false))
                .thenReturn(new CoachingSourceAdapter.SyncResult("pending", 1, null, false))
                .thenReturn(new CoachingSourceAdapter.SyncResult("synchronized", 1, null, false));
        new CoachingSourceWorker(outbox, adapter, new CoachingProperties()).tick();
        assertEquals(1, completed());
        verify(adapter, times(3)).synchronize(eq(1L), any(), anyString());
    }

    @Test void resumeDoesNotRoundAReadyJobIntoTheFuture() {
        queue(1);
        jdbc.sql("UPDATE coaching_source_outbox SET available_at=TIMESTAMP '2026-09-01 00:00:00'").update();
        var now = Instant.parse("2026-09-15T00:00:00.900Z");
        var job = outbox.claim(now).orElseThrow();
        outbox.resume(job, now);
        assertTrue(outbox.claim(now).isPresent(), "Second-precision rounding must not add scheduler delay");
    }

    @Test void failureBacksOffOneOwnerWhileOtherOwnersContinue() {
        queue(1); queue(2);
        when(adapter.synchronize(eq(1L), any(), anyString())).thenThrow(new IllegalStateException("private failure"));
        new CoachingSourceWorker(outbox, adapter, new CoachingProperties()).tick();
        assertEquals(1, completed());
        assertEquals("SOURCE_SYNC_FAILURE", jdbc.sql("SELECT last_error_code FROM coaching_source_outbox WHERE user_id=1")
                .query(String.class).single());
        verify(adapter, times(1)).synchronize(eq(1L), any(), anyString());
        verify(adapter, times(1)).synchronize(eq(2L), any(), anyString());
    }

    @Test void blockedOwnerRetainsItsSafeReasonAndDoesNotStarveOthers() {
        queue(1); queue(2);
        when(adapter.synchronize(eq(1L), any(), anyString()))
                .thenReturn(new CoachingSourceAdapter.SyncResult("blocked", 0, "stale_engine_cutoff", false));
        new CoachingSourceWorker(outbox, adapter, new CoachingProperties()).tick();
        assertEquals(1, completed());
        assertEquals("stale_engine_cutoff", jdbc.sql("SELECT last_error_code FROM coaching_source_outbox WHERE user_id=1")
                .query(String.class).single());
    }

    @Test void elapsedBudgetDoesNotClaimMoreWorkAfterTheCurrentCallFinishes() {
        queue(1); queue(2);
        var elapsed = new AtomicLong();
        when(adapter.synchronize(anyLong(), any(), anyString())).thenAnswer(invocation -> {
            elapsed.set(Duration.ofSeconds(10).toNanos());
            return new CoachingSourceAdapter.SyncResult("synchronized", 1, null, false);
        });
        new CoachingSourceWorker(outbox, adapter, new CoachingProperties(), Clock.systemUTC(), elapsed::get).tick();
        assertEquals(1, completed());
        assertEquals(0, jdbc.sql("SELECT COUNT(*) FROM coaching_source_outbox WHERE lease_token IS NOT NULL")
                .query(Integer.class).single());
        verify(adapter, times(1)).synchronize(anyLong(), any(), anyString());
    }

    @Test void cutoffUsesKoreaDateEvenWhenClockIsUtc() {
        queue(1);
        jdbc.sql("UPDATE coaching_source_outbox SET available_at=TIMESTAMP '2026-09-01 00:00:00'").update();
        var clock = Clock.fixed(Instant.parse("2026-09-14T16:00:00Z"), ZoneOffset.UTC);
        new CoachingSourceWorker(outbox, adapter, new CoachingProperties(), clock, () -> 0L).tick();
        verify(adapter).synchronize(eq(1L), eq(LocalDate.of(2026, 9, 15)), anyString());
    }

    @Test void slowClaimReleasesItsLeaseWithoutStartingAnOverBudgetHttpCall() {
        queue(1);
        var elapsed = new AtomicLong();
        var slowOutbox = spy(outbox);
        doAnswer(invocation -> {
            var job = invocation.callRealMethod();
            elapsed.set(Duration.ofSeconds(10).toNanos());
            return job;
        }).when(slowOutbox).claim(any());
        new CoachingSourceWorker(slowOutbox, adapter, new CoachingProperties(), Clock.systemUTC(), elapsed::get).tick();
        assertEquals(0, completed());
        assertTrue(outbox.claim(Instant.now()).isPresent());
        verifyNoInteractions(adapter);
    }

    @Test void interruptedWorkerLeavesReadyWorkUnclaimed() {
        queue(1);
        try {
            Thread.currentThread().interrupt();
            new CoachingSourceWorker(outbox, adapter, new CoachingProperties()).tick();
            verifyNoInteractions(adapter);
        } finally { Thread.interrupted(); }
        assertEquals(0, completed());
        assertTrue(outbox.claim(Instant.now()).isPresent());
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1, 101})
    void invalidJobLimitFailsBeforeAnyQueueOrHttpAccess(int limit) {
        var properties = new CoachingProperties(); properties.setSourceSyncMaxJobsPerTick(limit);
        assertThrows(IllegalArgumentException.class, () -> new CoachingSourceWorker(outbox, adapter, properties));
        verifyNoInteractions(adapter);
    }

    @ParameterizedTest
    @ValueSource(longs = {0, -1, 999, 60001})
    void invalidTimeBudgetFailsAtStartup(long millis) {
        var properties = new CoachingProperties(); properties.setSourceSyncTimeBudget(Duration.ofMillis(millis));
        assertThrows(IllegalArgumentException.class, () -> new CoachingSourceWorker(outbox, adapter, properties));
    }
}
