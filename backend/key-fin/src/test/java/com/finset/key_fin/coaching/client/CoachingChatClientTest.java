package com.finset.key_fin.coaching.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.finset.key_fin.coaching.dto.CoachingSessionView;
import com.finset.key_fin.coaching.dto.CoachingTurnReply;

class CoachingChatClientTest {

	private static final String BASE_URL = "https://coaching.example.com";
	private static final String TOKEN = "coaching-backend-token-0123456789abcdef";
	private static final long USER_ID = 970L;
	private static final String SESSION_JSON = """
			{"id":"sess-1","coaching_id":null,"created_at":1789000000.5,"expires_at":1789086400.5,
			 "messages":[{"role":"user","content":"복리가 뭐야?","response":null},
			             {"role":"assistant","content":"이자에 이자가 붙는 방식이에요.","response":{"kind":"chat","id":"ans-1"}}]}
			""";
	private static final String CHAT_ANSWER_JSON = """
			{"id":"ans-2","answer_type":"spending_history","status":"needs_data","text":"연결된 소비 자료가 없어요.",
			 "wording_source":"template","model":"none","fallback_reason":"no_ledger","evidence":{"coverage":"unknown"},
			 "created_at":1789000100.0}
			""";
	private static final String COACHING_JSON = """
			{"id":"coach-3","text":"이번 달 말 잔액은 12만 원 남을 것 같아요.","wording_source":"llm","model":"qwen",
			 "fallback_reason":null,"receipt":{"engine_commit":"abc","trigger":"forecast"},"created_at":1789000200.0}
			""";

	private MockRestServiceServer server;
	private CoachingChatClient client;

	@BeforeEach
	void setUp() {
		RestClient.Builder builder = RestClient.builder()
				.baseUrl(BASE_URL)
				.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + TOKEN);
		server = MockRestServiceServer.bindTo(builder).build();
		client = new CoachingChatClient(builder.build());
	}

	@Test
	void 세션_생성은_빈_본문과_멱등키를_보내고_만료와_메시지를_읽는다() {
		server.expect(requestTo(BASE_URL + "/v1/sessions"))
				.andExpect(method(HttpMethod.POST))
				.andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer " + TOKEN))
				.andExpect(header("Idempotency-Key", Matchers.not(Matchers.emptyOrNullString())))
				.andExpect(header("X-Coaching-User", "970"))
				.andExpect(content().json("{}"))
				.andRespond(withStatus(HttpStatus.OK).contentType(MediaType.APPLICATION_JSON).body(SESSION_JSON));

		CoachingSessionView session = client.createSession(USER_ID);

		assertThat(session.id()).isEqualTo("sess-1");
		assertThat(session.expiresAt()).isEqualTo(1789086400.5);
		assertThat(session.messages()).extracting(CoachingSessionView.Message::role).containsExactly("user", "assistant");
		server.verify();
	}

	@Test
	void 세션_조회는_경로에_세션_id를_넣는다() {
		server.expect(requestTo(BASE_URL + "/v1/sessions/sess-1"))
				.andExpect(method(HttpMethod.GET))
				.andRespond(withStatus(HttpStatus.OK).contentType(MediaType.APPLICATION_JSON).body(SESSION_JSON));

		assertThat(client.getSession(USER_ID, "sess-1").messages()).hasSize(2);
		server.verify();
	}

	@Test
	void 메시지는_question_본문으로_보내고_ChatAnswer를_읽는다() {
		server.expect(requestTo(BASE_URL + "/v1/sessions/sess-1/messages"))
				.andExpect(method(HttpMethod.POST))
				.andExpect(header("Idempotency-Key", Matchers.not(Matchers.emptyOrNullString())))
				.andExpect(jsonPath("$.question").value("이번 달 얼마 썼어?"))
				.andRespond(withStatus(HttpStatus.OK).contentType(MediaType.APPLICATION_JSON).body(CHAT_ANSWER_JSON));

		CoachingTurnReply reply = client.sendMessage(USER_ID, "sess-1", "이번 달 얼마 썼어?");

		assertThat(reply.isCoaching()).isFalse();
		assertThat(reply.status()).isEqualTo("needs_data");
		assertThat(reply.wordingSource()).isEqualTo("template");
		assertThat(reply.fallbackReason()).isEqualTo("no_ledger");
		server.verify();
	}

	@Test
	void receipt가_있는_Coaching_응답은_isCoaching이_참이다() {
		server.expect(requestTo(BASE_URL + "/v1/sessions/sess-1/messages"))
				.andRespond(withStatus(HttpStatus.OK).contentType(MediaType.APPLICATION_JSON).body(COACHING_JSON));

		CoachingTurnReply reply = client.sendMessage(USER_ID, "sess-1", "월말 잔액 예측해줘");

		assertThat(reply.isCoaching()).isTrue();
		assertThat(reply.status()).isNull();
		assertThat(reply.text()).contains("12만 원");
		server.verify();
	}
}
