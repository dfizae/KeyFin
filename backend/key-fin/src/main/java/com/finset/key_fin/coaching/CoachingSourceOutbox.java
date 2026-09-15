package com.finset.key_fin.coaching;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

/** Durable source refresh signal only; no financial payload or credential is copied into the queue. */
@Repository
public class CoachingSourceOutbox {
    private final JdbcClient jdbc;
    private final CoachingProperties properties;

    public CoachingSourceOutbox(JdbcClient jdbc, CoachingProperties properties) {
        this.jdbc = jdbc;
        this.properties = properties;
    }

    public record Job(long userId, long generation, int attempts, String leaseToken) { }

    /** Joins the source JPA transaction. A remote call must never be added to this method. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueue(long userId) {
        if (!properties.isSourceSyncEnabled() || !properties.getOwnerIds().containsKey(userId)) {
            return;
        }
        jdbc.sql("""
                INSERT INTO coaching_source_outbox(user_id,generation,completed_generation,attempts,available_at)
                VALUES(:userId,1,0,0,CURRENT_TIMESTAMP)
                ON DUPLICATE KEY UPDATE generation=generation+1,available_at=CURRENT_TIMESTAMP
                """).param("userId",userId).update();
    }

    public Optional<Job> claim(Instant now) {
        var candidate = jdbc.sql("""
                SELECT user_id,generation,attempts FROM coaching_source_outbox
                WHERE generation>completed_generation AND available_at<=:now
                  AND (lease_until IS NULL OR lease_until<:now)
                ORDER BY available_at,user_id LIMIT 1
                """).param("now", Timestamp.from(now)).query((rs, n) -> new Job(rs.getLong("user_id"),
                rs.getLong("generation"), rs.getInt("attempts"), UUID.randomUUID().toString())).optional();
        if (candidate.isEmpty()) {
            return Optional.empty();
        }
        var job = candidate.get();
        int changed = jdbc.sql("""
                UPDATE coaching_source_outbox SET lease_token=:token,lease_until=:until
                WHERE user_id=:userId AND generation>completed_generation AND available_at<=:now
                  AND (lease_until IS NULL OR lease_until<:now)
                """).param("token", job.leaseToken()).param("until", Timestamp.from(now.plusSeconds(300)))
                .param("userId", job.userId()).param("now", Timestamp.from(now)).update();
        return changed == 1 ? candidate : Optional.empty();
    }
    public void complete(Job job) {
        jdbc.sql("""
                UPDATE coaching_source_outbox SET completed_generation=:generation,attempts=0,
                  lease_token=NULL,lease_until=NULL,last_error_code=NULL
                WHERE user_id=:userId AND lease_token=:token
                """).param("generation", job.generation()).param("userId", job.userId()).param("token", job.leaseToken()).update();
    }

    public void retry(Job job, String code, Instant now) {
        if (!code.matches("[A-Za-z0-9_]{1,80}")) {
            throw new IllegalArgumentException("A safe error code is required");
        }
        long seconds = Math.min(3600, 30L << Math.min(job.attempts(), 7));
        jdbc.sql("""
                UPDATE coaching_source_outbox SET attempts=attempts+1,available_at=:next,
                  lease_token=NULL,lease_until=NULL,last_error_code=:code
                WHERE user_id=:userId AND lease_token=:token
                """).param("next", Timestamp.from(now.plusSeconds(seconds))).param("code", code)
                .param("userId", job.userId()).param("token", job.leaseToken()).update();
    }

    public void resume(Job job, Instant now) {
        // The existing TIMESTAMP has second precision. Explicitly floor it so databases that
        // round fractional seconds cannot postpone immediately pending work into the future.
        jdbc.sql("""
                UPDATE coaching_source_outbox SET lease_token=NULL,lease_until=NULL,available_at=:now
                WHERE user_id=:userId AND lease_token=:token
                """).param("now", Timestamp.from(now.truncatedTo(ChronoUnit.SECONDS)))
                .param("userId", job.userId()).param("token", job.leaseToken()).update();
    }
}
