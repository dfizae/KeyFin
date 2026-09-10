package com.finset.key_fin.link.controller;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.global.exception.GlobalExceptionHandler;
import com.finset.key_fin.link.dto.request.FinanceLinkRequest;
import com.finset.key_fin.link.dto.response.FinanceLinkResponse;
import com.finset.key_fin.link.dto.response.LinkCandidatesResponse;
import com.finset.key_fin.link.exception.LinkErrorCode;
import com.finset.key_fin.link.service.FinanceLinkService;
import com.finset.key_fin.link.service.LinkCandidateService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class LinkControllerTest {

	private static final long USER_ID = 1L;

	private FinanceLinkService financeLinkService;
	private LinkCandidateService linkCandidateService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		financeLinkService = mock(FinanceLinkService.class);
		linkCandidateService = mock(LinkCandidateService.class);
		mockMvc = standaloneSetup(new LinkController(financeLinkService, linkCandidateService))
				.setControllerAdvice(new GlobalExceptionHandler())
				.setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
				.build();
		SecurityContextHolder.getContext().setAuthentication(
				UsernamePasswordAuthenticationToken.authenticated(USER_ID, null, List.of())
		);
	}

	@AfterEach
	void tearDown() {
		SecurityContextHolder.clearContext();
	}

	@Test
	void 입력한_금융망_이메일로_회원을_연결한다() throws Exception {
		FinanceLinkRequest request = new FinanceLinkRequest("finance@qwer.com");
		when(financeLinkService.connect(USER_ID, request))
				.thenReturn(FinanceLinkResponse.of(true));

		mockMvc.perform(post("/api/v1/links/connect")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"financeEmail":"finance@qwer.com"}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.connected").value(true));

		verify(financeLinkService).connect(USER_ID, request);
	}

	@Test
	void 올바르지_않은_금융망_이메일을_거절한다() throws Exception {
		mockMvc.perform(post("/api/v1/links/connect")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"financeEmail":"invalid-email"}
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.code").value("COMMON_001"));
	}

	@Test
	void 금융망_연결_상태를_조회한다() throws Exception {
		when(financeLinkService.getStatus(USER_ID)).thenReturn(FinanceLinkResponse.of(false));

		mockMvc.perform(get("/api/v1/links/status"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.connected").value(false));

		verify(financeLinkService).getStatus(USER_ID);
	}

	@Test
	void 계좌_카드_후보_목록을_조회한다() throws Exception {
		when(linkCandidateService.getCandidates(USER_ID)).thenReturn(new LinkCandidatesResponse(
				List.of(new LinkCandidatesResponse.AccountCandidate("0010011073486799", "001", "한국은행", 1_500_000L, false)),
				List.of(new LinkCandidatesResponse.CardCandidate("1003198565339181", "롯데카드", "디지로카 SEOUL", "0323555042323510", true))
		));

		mockMvc.perform(get("/api/v1/links/candidates"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.accounts[0].finAccountNo").value("0010011073486799"))
				.andExpect(jsonPath("$.data.accounts[0].bankName").value("한국은행"))
				.andExpect(jsonPath("$.data.accounts[0].balance").value(1_500_000))
				.andExpect(jsonPath("$.data.accounts[0].linked").value(false))
				.andExpect(jsonPath("$.data.cards[0].cardNo").value("1003198565339181"))
				.andExpect(jsonPath("$.data.cards[0].issuerName").value("롯데카드"))
				.andExpect(jsonPath("$.data.cards[0].linked").value(true));

		verify(linkCandidateService).getCandidates(USER_ID);
	}

	@Test
	void 금융망_미연결_사용자의_후보_목록_요청은_409로_거절한다() throws Exception {
		when(linkCandidateService.getCandidates(USER_ID))
				.thenThrow(new BusinessException(LinkErrorCode.FINANCE_NOT_CONNECTED));

		mockMvc.perform(get("/api/v1/links/candidates"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.code").value("LINK_002"));
	}
}
