package com.finset.key_fin.user.controller;

import com.finset.key_fin.global.exception.GlobalExceptionHandler;
import com.finset.key_fin.user.dto.request.CoachPersonaUpdateRequest;
import com.finset.key_fin.user.service.CoachSettingsService;
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
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class CoachSettingsControllerTest {

	private static final long USER_ID = 1L;

	private CoachSettingsService coachSettingsService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		coachSettingsService = mock(CoachSettingsService.class);
		mockMvc = standaloneSetup(new CoachSettingsController(coachSettingsService))
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
	void 코치_말투를_변경한다() throws Exception {
		mockMvc.perform(put("/api/v1/settings/coach")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"coachPersona\":\"DODO\"}"))
				.andExpect(status().isOk())
				.andExpect(content().string(""));

		verify(coachSettingsService).updateCoachPersona(
				eq(USER_ID), any(CoachPersonaUpdateRequest.class));
	}

	@Test
	void 코치_말투가_누락되면_400을_반환한다() throws Exception {
		mockMvc.perform(put("/api/v1/settings/coach")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"));

		verifyNoInteractions(coachSettingsService);
	}

	@Test
	void 지원하지_않는_코치_말투는_읽을_수_없는_본문으로_거절한다() throws Exception {
		mockMvc.perform(put("/api/v1/settings/coach")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"coachPersona\":\"UNKNOWN\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_002"));

		verifyNoInteractions(coachSettingsService);
	}
}
