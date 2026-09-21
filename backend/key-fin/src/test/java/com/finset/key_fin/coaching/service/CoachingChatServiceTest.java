package com.finset.key_fin.coaching.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;

import com.finset.key_fin.coaching.client.CoachingChatClient;
import com.finset.key_fin.coaching.client.CoachingTwinClient;
import com.finset.key_fin.coaching.dto.ChatHistoryResponse;
import com.finset.key_fin.coaching.dto.ChatReply;
import com.finset.key_fin.coaching.dto.CoachingSessionView;
import com.finset.key_fin.coaching.dto.CoachingTurnReply;
import com.finset.key_fin.coaching.dto.FdtBootstrap;
import com.finset.key_fin.coaching.entity.CoachingSession;
import com.finset.key_fin.coaching.exception.CoachingErrorCode;
import com.finset.key_fin.coaching.repository.CoachingSessionRepository;
import com.finset.key_fin.global.exception.BusinessException;

class CoachingChatServiceTest {

	private static final long USER_ID = 970L;
	private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
	private static final Instant NOW = Instant.parse("2026-09-10T03:00:00Z");
	private static final double NEW_EXPIRES = NOW.getEpochSecond() + 86400;

	private final CoachingSessionRepository sessionRepository = mock(CoachingSessionRepository.class);
	private final CoachingChatClient chatClient = mock(CoachingChatClient.class);
	private final CoachingTwinClient twinClient = mock(CoachingTwinClient.class);
	private final FdtBootstrapService bootstrapService = mock(FdtBootstrapService.class);
	private final FdtBootstrap bootstrap = mock(FdtBootstrap.class);

	private CoachingChatService service;

	@BeforeEach
	void setUp() {
		service = new CoachingChatService(sessionRepository, chatClient, twinClient, bootstrapService,
				Clock.fixed(NOW, SEOUL));
		given(bootstrapService.build(USER_ID)).willReturn(bootstrap);
		given(sessionRepository.save(any(CoachingSession.class))).willAnswer(inv -> inv.getArgument(0));
	}

	@Test
	void 세션이_없으면_트윈을_보내고_세션을_만든_뒤_질문한다() {
		given(sessionRepository.findByUserId(USER_ID)).willReturn(Optional.empty());
		given(chatClient.createSession(USER_ID)).willReturn(new CoachingSessionView("sess-new", NEW_EXPIRES, List.of()));
		given(chatClient.sendMessage(USER_ID, "sess-new", "복리가 뭐야?")).willReturn(chatAnswer("answered", "llm"));

		ChatReply reply = service.chat(USER_ID, "복리가 뭐야?");

		verify(twinClient).create(USER_ID, bootstrap);
		verify(sessionRepository).save(any(CoachingSession.class));
		assertThat(reply.kind()).isEqualTo(ChatReply.Kind.CHAT);
		assertThat(reply.status()).isEqualTo("answered");
		assertThat(reply.source()).isEqualTo("llm");
		assertThat(reply.answerId()).isEqualTo("ans-1");
	}

	@Test
	void 유효한_세션이_있으면_트윈만_다시_보내고_세션은_다시_만들지_않는다() {
		given(sessionRepository.findByUserId(USER_ID)).willReturn(Optional.of(session("sess-live", 60)));
		given(chatClient.sendMessage(USER_ID, "sess-live", "월말 예측")).willReturn(coaching());

		ChatReply reply = service.chat(USER_ID, "월말 예측");

		verify(twinClient).create(USER_ID, bootstrap);
		verify(chatClient, never()).createSession(anyLong());
		assertThat(reply.kind()).isEqualTo(ChatReply.Kind.COACHING);
		assertThat(reply.status()).isEqualTo("answered");
		assertThat(reply.answerId()).isEqualTo("coach-1");
	}

	@Test
	void 만료된_세션은_같은_행을_새_세션으로_바꾼다() {
		CoachingSession expired = session("sess-old", -60);
		given(sessionRepository.findByUserId(USER_ID)).willReturn(Optional.of(expired));
		given(chatClient.createSession(USER_ID)).willReturn(new CoachingSessionView("sess-new", NEW_EXPIRES, List.of()));
		given(chatClient.sendMessage(USER_ID, "sess-new", "질문")).willReturn(chatAnswer("answered", "engine"));

		service.chat(USER_ID, "질문");

		verify(twinClient).create(USER_ID, bootstrap);
		assertThat(expired.getSessionId()).isEqualTo("sess-new");
		assertThat(expired.getExpiresAt()).isEqualTo(LocalDateTime.ofInstant(NOW.plusSeconds(86400), SEOUL));
	}

	@Test
	void 코칭_서버가_410으로_거절하면_새_세션으로_한_번_다시_보낸다() {
		CoachingSession live = session("sess-live", 60);
		given(sessionRepository.findByUserId(USER_ID)).willReturn(Optional.of(live));
		given(chatClient.sendMessage(USER_ID, "sess-live", "질문")).willThrow(clientError(HttpStatus.GONE));
		given(chatClient.createSession(USER_ID)).willReturn(new CoachingSessionView("sess-new", NEW_EXPIRES, List.of()));
		given(chatClient.sendMessage(USER_ID, "sess-new", "질문")).willReturn(chatAnswer("answered", "llm"));

		ChatReply reply = service.chat(USER_ID, "질문");

		assertThat(reply.answerId()).isEqualTo("ans-1");
		assertThat(live.getSessionId()).isEqualTo("sess-new");
		verify(twinClient).create(USER_ID, bootstrap);
	}

	@Test
	void 그_외_4xx와_연결_실패는_AI_001이다() {
		given(sessionRepository.findByUserId(USER_ID)).willReturn(Optional.of(session("sess-live", 60)));
		given(chatClient.sendMessage(USER_ID, "sess-live", "a")).willThrow(clientError(HttpStatus.UNPROCESSABLE_ENTITY));
		given(chatClient.sendMessage(USER_ID, "sess-live", "b")).willThrow(new ResourceAccessException("timeout"));

		assertThatThrownBy(() -> service.chat(USER_ID, "a"))
				.isInstanceOf(BusinessException.class)
				.extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(CoachingErrorCode.COACHING_UNAVAILABLE);
		assertThatThrownBy(() -> service.chat(USER_ID, "b"))
				.isInstanceOf(BusinessException.class)
				.extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(CoachingErrorCode.COACHING_UNAVAILABLE);
		verify(chatClient, never()).createSession(anyLong());
	}

	@Test
	void 트윈_전송이_실패해도_경고만_남기고_대화는_이어진다() {
		given(sessionRepository.findByUserId(USER_ID)).willReturn(Optional.of(session("sess-live", 60)));
		given(twinClient.create(USER_ID, bootstrap))
				.willThrow(clientError(HttpStatus.UNPROCESSABLE_ENTITY))
				.willThrow(new ResourceAccessException("timeout"));
		given(chatClient.sendMessage(USER_ID, "sess-live", "질문")).willReturn(chatAnswer("answered", "llm"));

		assertThat(service.chat(USER_ID, "질문").answerId()).isEqualTo("ans-1");
		assertThat(service.chat(USER_ID, "질문").answerId()).isEqualTo("ans-1");
		verify(chatClient, never()).createSession(anyLong());
	}

	@Test
	void 이력은_세션이_없거나_만료됐으면_비어_있다() {
		given(sessionRepository.findByUserId(USER_ID)).willReturn(Optional.empty(), Optional.of(session("sess-old", -1)));

		assertThat(service.history(USER_ID).messages()).isEmpty();
		assertThat(service.history(USER_ID).messages()).isEmpty();
		verify(chatClient, never()).getSession(anyLong(), anyString());
	}

	@Test
	void 이력은_코칭_서버_메시지를_그대로_돌려주고_닫힌_세션이면_비운다() {
		given(sessionRepository.findByUserId(USER_ID)).willReturn(Optional.of(session("sess-live", 60)));
		given(chatClient.getSession(USER_ID, "sess-live"))
				.willReturn(new CoachingSessionView("sess-live", NEW_EXPIRES, List.of(
						new CoachingSessionView.Message("user", "복리가 뭐야?"),
						new CoachingSessionView.Message("assistant", "이자에 이자가 붙어요."))))
				.willThrow(clientError(HttpStatus.GONE));

		ChatHistoryResponse history = service.history(USER_ID);
		assertThat(history.messages()).extracting(ChatHistoryResponse.Entry::content)
				.containsExactly("복리가 뭐야?", "이자에 이자가 붙어요.");
		assertThat(history.expiresAt()).isEqualTo(LocalDateTime.ofInstant(NOW.plusSeconds(86400), SEOUL));

		assertThat(service.history(USER_ID).messages()).isEmpty();
	}

	private static CoachingSession session(String sessionId, long secondsFromNow) {
		return CoachingSession.open(USER_ID, sessionId,
				LocalDateTime.ofInstant(NOW.plusSeconds(secondsFromNow), SEOUL));
	}

	private static CoachingTurnReply chatAnswer(String status, String source) {
		return new CoachingTurnReply("ans-1", "finance_education", status, "답변", source, null, null);
	}

	private static CoachingTurnReply coaching() {
		return new CoachingTurnReply("coach-1", null, null, "예측 답변", "llm", null,
				Map.of("trigger", "forecast"));
	}

	private static HttpClientErrorException clientError(HttpStatus status) {
		return HttpClientErrorException.create(status, status.getReasonPhrase(), HttpHeaders.EMPTY, new byte[0], null);
	}
}
