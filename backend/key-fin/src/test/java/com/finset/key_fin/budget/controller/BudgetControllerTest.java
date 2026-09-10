package com.finset.key_fin.budget.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;

import com.finset.key_fin.budget.dto.response.BudgetProposalResponse;
import com.finset.key_fin.budget.dto.response.BudgetProposalResponse.EnvelopeProposal;
import com.finset.key_fin.budget.service.BudgetService;
import com.finset.key_fin.global.exception.GlobalExceptionHandler;

class BudgetControllerTest {

	private BudgetService budgetService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		budgetService = mock(BudgetService.class);
		mockMvc = standaloneSetup(new BudgetController(budgetService))
				.setControllerAdvice(new GlobalExceptionHandler())
				.setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
				.build();
		SecurityContextHolder.getContext().setAuthentication(
				UsernamePasswordAuthenticationToken.authenticated(1L, null, List.of()));
	}

	@AfterEach
	void tearDown() {
		SecurityContextHolder.clearContext();
	}

	@Test
	void createsProposalForAuthenticatedUser() throws Exception {
		BudgetProposalResponse response = new BudgetProposalResponse(
				11L, "202609", "PROPOSED", "최근 3개월 평균",
				List.of(new EnvelopeProposal(1, "외식", 121000, 120652)));
		when(budgetService.propose(1L)).thenReturn(response);

		mockMvc.perform(post("/api/v1/budgets/proposals"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.budgetId").value(11))
				.andExpect(jsonPath("$.data.month").value("202609"))
				.andExpect(jsonPath("$.data.status").value("PROPOSED"))
				.andExpect(jsonPath("$.data.envelopes[0].envelopeId").value(1))
				.andExpect(jsonPath("$.data.envelopes[0].proposedAmount").value(121000));
	}
}
