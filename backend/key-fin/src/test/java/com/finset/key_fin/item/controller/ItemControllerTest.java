package com.finset.key_fin.item.controller;

import com.finset.key_fin.global.exception.GlobalExceptionHandler;
import com.finset.key_fin.item.dto.response.AvatarEquipmentResponse;
import com.finset.key_fin.item.dto.response.EquippedItemResponse;
import com.finset.key_fin.item.dto.response.UserItemResponse;
import com.finset.key_fin.item.service.ItemService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static com.finset.key_fin.item.entity.ItemSlotType.UPPER_BODY;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class ItemControllerTest {
	private final ItemService service = mock(ItemService.class);
	private MockMvc mvc;

	@BeforeEach
	void setUp() {
		mvc = standaloneSetup(new ItemController(service))
				.setControllerAdvice(new GlobalExceptionHandler())
				.setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
		SecurityContextHolder.getContext().setAuthentication(
				UsernamePasswordAuthenticationToken.authenticated(1L, null, List.of()));
	}

	@AfterEach
	void cleanup() {
		SecurityContextHolder.clearContext();
	}

	@Test
	void listsUsingPrincipalAndOptionalSlotQuery() throws Exception {
		when(service.getItems(1L, null)).thenReturn(List.of());
		mvc.perform(get("/api/v1/items").param("userId", "2"))
				.andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
		when(service.getItems(1L, "UPPER_BODY")).thenReturn(List.of(
				new UserItemResponse(3L, 103L, "셔츠", UPPER_BODY, "shirt", false)));
		mvc.perform(get("/api/v1/items").param("slotType", "UPPER_BODY"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data[0].userItemId").value(3))
				.andExpect(jsonPath("$.data[0].equipped").value(false));
		verify(service).getItems(1L, null);
		verify(service).getItems(1L, "UPPER_BODY");
	}

	@Test
	void changesEquipmentWithoutRequestBody() throws Exception {
		when(service.equip(1L, 3L)).thenReturn(new AvatarEquipmentResponse(
				List.of(new EquippedItemResponse(3L, 103L, UPPER_BODY, "shirt"))));
		when(service.unequip(1L, 3L)).thenReturn(new AvatarEquipmentResponse(List.of()));
		mvc.perform(put("/api/v1/items/3/equip"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.equipped[0].userItemId").value(3));
		mvc.perform(delete("/api/v1/items/3/equip"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.equipped").isEmpty());
	}

	@ParameterizedTest
	@ValueSource(strings = {"0", "-1", "text", "9223372036854775808"})
	void rejectsInvalidIds(String id) throws Exception {
		for (var request : List.of(put("/api/v1/items/" + id + "/equip"),
				delete("/api/v1/items/" + id + "/equip"))) {
			mvc.perform(request).andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.code").value("COMMON_001"));
		}
		verifyNoInteractions(service);
	}
}
