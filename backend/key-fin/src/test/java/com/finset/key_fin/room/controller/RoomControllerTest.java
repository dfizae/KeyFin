package com.finset.key_fin.room.controller;

import com.finset.key_fin.global.exception.GlobalExceptionHandler;
import com.finset.key_fin.room.dto.response.RoomResponse;
import com.finset.key_fin.room.entity.FurniturePlacementDirection;
import com.finset.key_fin.room.entity.FurniturePlacementStatus;
import com.finset.key_fin.room.entity.ItemSlotType;
import com.finset.key_fin.room.service.RoomService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class RoomControllerTest {

	private RoomService roomService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		roomService = mock(RoomService.class);
		mockMvc = standaloneSetup(new RoomController(roomService))
				.setControllerAdvice(new GlobalExceptionHandler())
				.setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
				.build();
	}

	@Test
	void returnsRoomHomeDataForAuthenticatedUser() throws Exception {
		RoomResponse response = roomResponse();
		when(roomService.getRoom(1L)).thenReturn(response);
		UsernamePasswordAuthenticationToken authentication =
				UsernamePasswordAuthenticationToken.authenticated(1L, null, List.of());
		SecurityContextHolder.getContext().setAuthentication(authentication);

		try {
			mockMvc.perform(get("/api/v1/room"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.success").value(true))
					.andExpect(jsonPath("$.code").value("SUCCESS"))
					.andExpect(jsonPath("$.data.theme").value("AUTUMN_2026"))
					.andExpect(jsonPath("$.data.avatar.equipped[0].slotType").value("HEAD"))
					.andExpect(jsonPath("$.data.avatar.equipped[0].itemId").value(1))
					.andExpect(jsonPath("$.data.avatar.reaction").doesNotExist())
					.andExpect(jsonPath("$.data.furnitures[0].itemId").value(4))
					.andExpect(jsonPath("$.data.furnitures[0].placementStatus").value("FLOOR"))
					.andExpect(jsonPath("$.data.furnitures[0].placementDirection").value("FRONT_RIGHT"))
					.andExpect(jsonPath("$.data.furnitures[0].positionX").value(165.000))
					.andExpect(jsonPath("$.data.coin.balance").value(1250))
					.andExpect(jsonPath("$.data.board.month").value("202609"))
					.andExpect(jsonPath("$.data.board.totalRemainingRate").value(36))
					.andExpect(jsonPath("$.data.attendance.checkedToday").value(false));

			verify(roomService).getRoom(1L);
		} finally {
			SecurityContextHolder.clearContext();
		}
	}

	private RoomResponse roomResponse() {
		return new RoomResponse(
				"AUTUMN_2026",
				new RoomResponse.AvatarResponse(
						List.of(
								new RoomResponse.EquippedItemResponse(ItemSlotType.HEAD, 1L, "hair_default"),
								new RoomResponse.EquippedItemResponse(ItemSlotType.FACE, 2L, "face_default"),
								new RoomResponse.EquippedItemResponse(ItemSlotType.UPPER_BODY, 3L, "outfit_default")
						),
						null
				),
				List.of(
						new RoomResponse.FurnitureResponse(
								4L,
								ItemSlotType.FLOOR,
								"sofa_default",
								FurniturePlacementStatus.FLOOR,
								FurniturePlacementDirection.FRONT_RIGHT,
								new BigDecimal("165.000"),
								new BigDecimal("280.000"),
								0
						)
				),
				new RoomResponse.CoinResponse(1250),
				new RoomResponse.BoardResponse("202609", 36),
				new RoomResponse.AttendanceResponse(false)
		);
	}
}
