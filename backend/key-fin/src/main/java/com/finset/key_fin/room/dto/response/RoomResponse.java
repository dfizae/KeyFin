package com.finset.key_fin.room.dto.response;

import com.finset.key_fin.room.entity.FurniturePlacementDirection;
import com.finset.key_fin.room.entity.FurniturePlacementStatus;
import com.finset.key_fin.room.entity.ItemSlotType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record RoomResponse(
		String theme,
		AvatarResponse avatar,
		List<FurnitureResponse> furnitures,
		CoinResponse coin,
		BoardResponse board,
		AttendanceResponse attendance
) {

	public record AvatarResponse(
			List<EquippedItemResponse> equipped,
			ReactionResponse reaction
	) {
	}

	public record EquippedItemResponse(
			ItemSlotType slotType,
			Long itemId,
			String assetKey
	) {
	}

	public record FurnitureResponse(
			Long itemId,
			ItemSlotType slotType,
			String assetKey,
			FurniturePlacementStatus placementStatus,
			FurniturePlacementDirection placementDirection,
			BigDecimal positionX,
			BigDecimal positionY,
			int layer
	) {
	}

	public record ReactionResponse(
			String type,
			LocalDateTime until
	) {
	}

	public record CoinResponse(int balance) {
	}

	public record BoardResponse(
			String month,
			int totalRemainingRate
	) {
	}

	public record AttendanceResponse(boolean checkedToday) {
	}
}
