package com.finset.key_fin.room.service;

import com.finset.key_fin.furniture.dto.response.PlacedFurnitureResponse;
import com.finset.key_fin.furniture.entity.FurniturePlacementDirection;
import com.finset.key_fin.furniture.entity.FurniturePlacementStatus;
import com.finset.key_fin.furniture.service.FurnitureService;
import com.finset.key_fin.item.dto.response.AvatarEquipmentResponse;
import com.finset.key_fin.item.entity.ItemSlotType;
import com.finset.key_fin.item.service.ItemService;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class RoomServiceTest {
	private final ItemService items = mock(ItemService.class);
	private final FurnitureService furnitures = mock(FurnitureService.class);
	private final RoomService service = new RoomServiceImpl(items, furnitures);

	@Test
	void usesAuthenticatedUsersActualPlacementsIncludingEmptyRoom() {
		when(items.getEquipment(1L)).thenReturn(new AvatarEquipmentResponse(List.of()));
		var placed = new PlacedFurnitureResponse(201L, 4L, ItemSlotType.FLOOR, "sofa_blue",
				FurniturePlacementStatus.FLOOR, FurniturePlacementDirection.FRONT_LEFT,
				new BigDecimal("165.123"), new BigDecimal("280.456"), -2);
		when(furnitures.getPlacedFurnitures(1L)).thenReturn(List.of(placed)).thenReturn(List.of());
		assertThat(service.getRoom(1).furnitures()).containsExactly(placed);
		assertThat(service.getRoom(1).furnitures()).isEmpty();
		verify(furnitures, times(2)).getPlacedFurnitures(1L);
	}
}
