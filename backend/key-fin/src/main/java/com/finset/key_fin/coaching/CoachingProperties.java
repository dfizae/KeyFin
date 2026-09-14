package com.finset.key_fin.coaching;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/** Deployment-owned credentials. Never bind these values from a request or expose them in a DTO. */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "coaching")
public class CoachingProperties {
    private boolean enabled = false;
    private URI baseUrl;
    private Duration timeout = Duration.ofSeconds(60);
    /** JWT user ID -> distinct Python client token, provisioned for the same financial owner. */
    private Map<Long, String> userTokens = new HashMap<>();
    /** Optional write-role credentials, used only by the internal data bridge, never by controllers. */
    private Map<Long, String> backendTokens = new HashMap<>();
    /** Python notification-role tokens for the inbox/ack API; user-role tokens cannot access it. */
    private Map<Long, String> notificationTokens = new HashMap<>();
}
