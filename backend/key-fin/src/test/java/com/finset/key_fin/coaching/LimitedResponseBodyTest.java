package com.finset.key_fin.coaching;

import org.junit.jupiter.api.Test;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.Flow;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.jupiter.api.Assertions.*;

class LimitedResponseBodyTest {
    @Test
    void cancelsOversizeResponseBeforeAllocatingItsChunk() {
        var cancelled = new AtomicBoolean();
        var subscriber = new LimitedResponseBody(3);
        subscriber.onSubscribe(new Flow.Subscription() {
            public void request(long count) { }
            public void cancel() { cancelled.set(true); }
        });
        subscriber.onNext(List.of(ByteBuffer.wrap(new byte[4])));
        assertTrue(cancelled.get());
        assertTrue(subscriber.getBody().toCompletableFuture().isCompletedExceptionally());
    }
}
