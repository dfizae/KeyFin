package com.finset.key_fin.link.controller;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.global.exception.GlobalExceptionHandler;
import com.finset.key_fin.link.dto.request.FinanceLinkRequest;
import com.finset.key_fin.link.dto.request.LinkAssetsRequest;
import com.finset.key_fin.link.dto.response.FinanceLinkResponse;
import com.finset.key_fin.link.dto.response.LinkAssetsResponse;
import com.finset.key_fin.link.dto.response.LinkCandidatesResponse;
import com.finset.key_fin.link.exception.LinkErrorCode;
import com.finset.key_fin.link.service.FinanceLinkService;
import com.finset.key_fin.link.service.LinkAssetService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class LinkControllerTest {

	private static final long USER_ID = 1L;

	private FinanceLinkService financeLinkService;
	private LinkCandidateService linkCandidateService;
	private LinkAssetService linkAssetService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		financeLinkService = mock(FinanceLinkService.class);
		linkCandidateService = mock(LinkCandidateService.class);
		linkAssetService = mock(LinkAssetService.class);
		mockMvc = standaloneSetup(new LinkController(financeLinkService, linkCandidateService, linkAssetService))
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
	void 선택한_계좌와_카드를_연결하고_201을_반환한다() throws Exception {
		LinkAssetsRequest request = new LinkAssetsRequest(List.of("0041456503815897"), List.of("1005872701650761"));
		when(linkAssetService.link(USER_ID, request)).thenReturn(new LinkAssetsResponse(1, 1));

		mockMvc.perform(post("/api/v1/links")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"accounts":["0041456503815897"],"cards":["1005872701650761"]}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.accounts").value(1))
				.andExpect(jsonPath("$.data.cards").value(1));

		verify(linkAssetService).link(USER_ID, request);
	}

	@Test
	void 빈_문자열_계좌번호는_400으로_거절한다() throws Exception {
		mockMvc.perform(post("/api/v1/links")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"accounts":[" "],"cards":[]}
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"));
	}

	@Test
	void 후보에_없는_자산_연결은_404로_거절한다() throws Exception {
		when(linkAssetService.link(eq(USER_ID), any(LinkAssetsRequest.class)))
				.thenThrow(new BusinessException(LinkErrorCode.FINANCE_ASSET_NOT_FOUND));

		mockMvc.perform(post("/api/v1/links")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"accounts":["9999999999999999"]}
								"""))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("LINK_004"));
	}

	@Test
	void 계좌_연결을_해제한다() throws Exception {
		mockMvc.perform(delete("/api/v1/links/accounts/10"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true));

		verify(linkAssetService).unlinkAccount(USER_ID, 10L);
	}

	@Test
	void 카드_연결을_해제한다() throws Exception {
		mockMvc.perform(delete("/api/v1/links/cards/20"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true));

		verify(linkAssetService).unlinkCard(USER_ID, 20L);
	}

	@Test
	void 본인_카드가_아닌_해제_요청은_404로_거절한다() throws Exception {
		doThrow(new BusinessException(LinkErrorCode.CARD_NOT_FOUND))
				.when(linkAssetService).unlinkCard(USER_ID, 20L);

		mockMvc.perform(delete("/api/v1/links/cards/20"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("LINK_006"));
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
