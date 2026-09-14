package com.finset.key_fin.user.controller;

import com.finset.key_fin.global.exception.GlobalExceptionHandler;
import com.finset.key_fin.user.dto.request.TransferSettingsUpdateRequest;
import com.finset.key_fin.user.dto.response.TransferSettingsResponse;
import com.finset.key_fin.user.service.TransferSettingsService;
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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class TransferSettingsControllerTest {

	private static final long USER_ID = 1L;

	private TransferSettingsService transferSettingsService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		transferSettingsService = mock(TransferSettingsService.class);
		mockMvc = standaloneSetup(new TransferSettingsController(transferSettingsService))
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
	void 이체_설정을_조회한다() throws Exception {
		when(transferSettingsService.getTransferSettings(USER_ID))
				.thenReturn(new TransferSettingsResponse(true, 1_000_000L, 2_000_000L));

		mockMvc.perform(get("/api/v1/settings/transfer"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.transferConsent").value(true))
				.andExpect(jsonPath("$.data.transferLimitOnce").value(1_000_000))
				.andExpect(jsonPath("$.data.transferLimitDaily").value(2_000_000));

		verify(transferSettingsService).getTransferSettings(USER_ID);
	}

	@Test
	void 이체_설정을_변경한다() throws Exception {
		when(transferSettingsService.updateTransferSettings(
				eq(USER_ID), any(TransferSettingsUpdateRequest.class)))
				.thenReturn(new TransferSettingsResponse(true, 1_000_000L, 2_000_000L));

		mockMvc.perform(put("/api/v1/settings/transfer")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"transferConsent":true,"transferLimitOnce":1000000,"transferLimitDaily":2000000}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.transferConsent").value(true))
				.andExpect(jsonPath("$.data.transferLimitOnce").value(1_000_000));
	}

	@Test
	void 이체_동의_여부가_누락되면_400을_반환한다() throws Exception {
		mockMvc.perform(put("/api/v1/settings/transfer")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"transferLimitOnce\":1000000,\"transferLimitDaily\":2000000}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"));
	}

	@Test
	void 이체_한도가_0이면_400을_반환한다() throws Exception {
		mockMvc.perform(put("/api/v1/settings/transfer")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"transferConsent\":true,\"transferLimitOnce\":0}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"));
	}
}
