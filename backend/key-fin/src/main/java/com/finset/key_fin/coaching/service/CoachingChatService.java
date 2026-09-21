package com.finset.key_fin.coaching.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;

import com.finset.key_fin.coaching.client.CoachingChatClient;
import com.finset.key_fin.coaching.client.CoachingTwinClient;
import com.finset.key_fin.coaching.dto.ChatHistoryResponse;
import com.finset.key_fin.coaching.dto.ChatReply;
import com.finset.key_fin.coaching.dto.CoachingSessionView;
import com.finset.key_fin.coaching.dto.CoachingTurnReply;
import com.finset.key_fin.coaching.entity.CoachingSession;
import com.finset.key_fin.coaching.exception.CoachingErrorCode;
import com.finset.key_fin.coaching.repository.CoachingSessionRepository;
import com.finset.key_fin.global.exception.BusinessException;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "coaching.api", name = "token")
public class CoachingChatService {

	private final CoachingSessionRepository sessionRepository;
	private final CoachingChatClient chatClient;
	private final CoachingTwinClient twinClient;
	private final FdtBootstrapService bootstrapService;
	private final Clock clock;

	public ChatReply chat(long userId, String message) {
		pushTwin(userId);
		CoachingSession session = activeSession(userId);
		try {
			return ChatReply.from(send(userId, session, message));
		} catch (HttpClientErrorException e) {
			if (!isSessionClosed(e)) {
				throw unavailable(e);
			}
			log.info("코칭 세션 종료로 재생성: userId={}, status={}", userId, e.getStatusCode());
			return ChatReply.from(send(userId, renew(userId, session), message));
		}
	}

	public ChatHistoryResponse history(long userId) {
		LocalDateTime now = LocalDateTime.now(clock);
		return sessionRepository.findByUserId(userId)
				.filter(session -> !session.isExpired(now))
				.map(session -> {
					try {
						return toHistory(chatClient.getSession(userId, session.getSessionId()));
					} catch (HttpClientErrorException e) {
						if (isSessionClosed(e) || e.getStatusCode() == HttpStatus.NOT_FOUND) {
							return ChatHistoryResponse.empty();
						}
						throw unavailable(e);
					} catch (HttpServerErrorException | ResourceAccessException e) {
						throw unavailable(e);
					}
				})
				.orElseGet(ChatHistoryResponse::empty);
	}

	private CoachingSession activeSession(long userId) {
		LocalDateTime now = LocalDateTime.now(clock);
		return sessionRepository.findByUserId(userId)
				.map(session -> session.isExpired(now) ? renew(userId, session) : session)
				.orElseGet(() -> renew(userId, null));
	}

	private CoachingSession renew(long userId, CoachingSession existing) {
		CoachingSessionView created;
		try {
			created = chatClient.createSession(userId);
		} catch (HttpClientErrorException | HttpServerErrorException | ResourceAccessException e) {
			throw unavailable(e);
		}
		LocalDateTime expiresAt = toLocal(created.expiresAt());
		if (existing == null) {
			return sessionRepository.save(CoachingSession.open(userId, created.id(), expiresAt));
		}
		existing.replace(created.id(), expiresAt);
		return sessionRepository.save(existing);
	}

	private void pushTwin(long userId) {
		try {
			twinClient.create(userId, bootstrapService.build(userId));
		} catch (HttpClientErrorException e) {
			log.warn("트윈 거부: userId={}, status={}, body={}", userId, e.getStatusCode(), e.getResponseBodyAsString());
			throw new BusinessException(CoachingErrorCode.TWIN_REJECTED, e);
		} catch (HttpServerErrorException | ResourceAccessException e) {
			throw unavailable(e);
		}
	}

	private CoachingTurnReply send(long userId, CoachingSession session, String message) {
		try {
			return chatClient.sendMessage(userId, session.getSessionId(), message);
		} catch (HttpServerErrorException | ResourceAccessException e) {
			throw unavailable(e);
		}
	}

	private ChatHistoryResponse toHistory(CoachingSessionView view) {
		return new ChatHistoryResponse(
				view.messages().stream()
						.map(m -> new ChatHistoryResponse.Entry(m.role(), m.content()))
						.toList(),
				toLocal(view.expiresAt()));
	}

	private LocalDateTime toLocal(double epochSeconds) {
		return LocalDateTime.ofInstant(Instant.ofEpochSecond((long) epochSeconds), clock.getZone());
	}

	private static boolean isSessionClosed(HttpClientErrorException e) {
		return e.getStatusCode() == HttpStatus.GONE || e.getStatusCode() == HttpStatus.CONFLICT;
	}

	private static BusinessException unavailable(Exception cause) {
		return new BusinessException(CoachingErrorCode.COACHING_UNAVAILABLE, cause);
	}
}
