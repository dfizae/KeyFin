package com.finset.key_fin.transaction.controller;

import com.finset.key_fin.global.exception.GlobalExceptionHandler;
import com.finset.key_fin.transaction.dto.response.TransactionListResponse;
import com.finset.key_fin.transaction.dto.response.TransactionListResponse.TransactionItem;
import com.finset.key_fin.transaction.entity.ConfirmStatus;
import com.finset.key_fin.transaction.entity.ExcludeTag;
import com.finset.key_fin.transaction.entity.TransactionStatus;
import com.finset.key_fin.transaction.entity.TransactionType;
import com.finset.key_fin.transaction.service.TransactionService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class TransactionControllerTest {

	private static final long USER_ID = 1L;

	private TransactionService transactionService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		transactionService = mock(TransactionService.class);
		mockMvc = standaloneSetup(new TransactionController(transactionService))
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
	void 거래_내역을_필터와_함께_조회한다() throws Exception {
		TransactionItem item = new TransactionItem(
				501L, TransactionType.CARD, "메가커피 역삼점", 4_500L,
				LocalDate.of(2026, 9, 8), LocalTime.of(14, 21),
				1, 102, "카페", ConfirmStatus.AUTO, ExcludeTag.NONE,
				TransactionStatus.NORMAL, null, null, 7L, null
		);
		when(transactionService.getTransactions(USER_ID, "202609", 1, 102, null, 7L, null, 20))
				.thenReturn(new TransactionListResponse(List.of(item), 481L));

		mockMvc.perform(get("/api/v1/transactions")
						.param("month", "202609")
						.param("envelopeId", "1")
						.param("subcategoryId", "102")
						.param("cardId", "7")
						.param("size", "20"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.items[0].id").value(501))
				.andExpect(jsonPath("$.data.items[0].txType").value("CARD"))
				.andExpect(jsonPath("$.data.items[0].subcategoryName").value("카페"))
				.andExpect(jsonPath("$.data.items[0].status").value("NORMAL"))
				.andExpect(jsonPath("$.data.nextCursor").value(481));

		verify(transactionService).getTransactions(USER_ID, "202609", 1, 102, null, 7L, null, 20);
	}

	@Test
	void 필터가_없어도_조회할_수_있다() throws Exception {
		when(transactionService.getTransactions(USER_ID, null, null, null, null, null, null, null))
				.thenReturn(new TransactionListResponse(List.of(), null));

		mockMvc.perform(get("/api/v1/transactions"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.items").isEmpty())
				.andExpect(jsonPath("$.data.nextCursor").doesNotExist());
	}
}
