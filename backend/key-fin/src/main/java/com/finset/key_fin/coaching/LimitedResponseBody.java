package com.finset.key_fin.coaching;

import java.io.ByteArrayOutputStream;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Flow;

/** Buffer at most the configured limit; the client separately enforces a whole-response deadline. */
final class LimitedResponseBody implements HttpResponse.BodySubscriber<byte[]> {
    private final int maximum;
    private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    private final CompletableFuture<byte[]> result = new CompletableFuture<>();
    private Flow.Subscription subscription;

    LimitedResponseBody(int maximum) { this.maximum = maximum; }

    @Override
    public CompletionStage<byte[]> getBody() { return result; }

    @Override
    public void onSubscribe(Flow.Subscription subscription) {
        this.subscription = subscription;
        subscription.request(1);
    }

    @Override
    public void onNext(List<ByteBuffer> buffers) {
        for (ByteBuffer buffer : buffers) {
            int size = buffer.remaining();
            if (size > maximum - bytes.size()) {
                subscription.cancel();
                result.completeExceptionally(new java.io.IOException("Coaching response exceeds configured bound"));
                return;
            }
            byte[] chunk = new byte[size];
            buffer.get(chunk);
            bytes.writeBytes(chunk);
        }
        subscription.request(1);
    }

    @Override
    public void onError(Throwable error) { result.completeExceptionally(error); }

    @Override
    public void onComplete() { result.complete(bytes.toByteArray()); }
}
