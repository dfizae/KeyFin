package com.finset.key_fin.coaching;

import com.finset.key_fin.transaction.entity.Transaction;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PostUpdate;
import org.springframework.stereotype.Component;

/** Hibernate's Spring bean container injects this listener; only same-transaction SQL is performed. */
@Component
public class CoachingTransactionListener {
    private final CoachingSourceOutbox outbox;

    public CoachingTransactionListener(CoachingSourceOutbox outbox) {
        this.outbox = outbox;
    }

    @PostPersist
    @PostUpdate
    public void changed(Transaction transaction) {
        outbox.enqueue(transaction.getUser().getId());
    }
}
