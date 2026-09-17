package com.finset.key_fin.user.controller;

import com.finset.key_fin.global.exception.GlobalExceptionHandler;
import com.finset.key_fin.user.dto.request.NotificationSettingsUpdateRequest;
import com.finset.key_fin.user.service.NotificationSettingsService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class NotificationSettingsControllerTest {

	private static final long USER_ID = 1L;

	private NotificationSettingsService notificationSettingsService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		notificationSettingsService = mock(NotificationSettingsService.class);
		mockMvc = standaloneSetup(new NotificationSettingsController(notificationSettingsService))
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
	void 알림_설정을_변경한다() throws Exception {
		mockMvc.perform(put("/api/v1/settings/notifications")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"notiCoaching":true,"notiBudgetAlert":true,"notiTransfer":true,"notiCleanup":false,"quietHoursStart":"23:00","quietHoursEnd":"08:00"}
								"""))
				.andExpect(status().isOk())
				.andExpect(content().string(""));

		verify(notificationSettingsService).updateNotificationSettings(
				eq(USER_ID), any(NotificationSettingsUpdateRequest.class));
	}

	@Test
	void 방해금지_시각을_모두_생략하면_해제할_수_있다() throws Exception {
		mockMvc.perform(put("/api/v1/settings/notifications")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"notiCoaching":true,"notiBudgetAlert":true,"notiTransfer":true,"notiCleanup":false,"quietHoursStart":null,"quietHoursEnd":null}
								"""))
				.andExpect(status().isOk());
	}

	@Test
	void 필수_알림_설정이_누락되면_400을_반환한다() throws Exception {
		mockMvc.perform(put("/api/v1/settings/notifications")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"notiBudgetAlert":true,"notiTransfer":true,"notiCleanup":false}
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"));
	}
}
