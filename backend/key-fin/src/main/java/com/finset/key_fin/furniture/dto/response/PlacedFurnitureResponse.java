package com.finset.key_fin.furniture.dto.response;

import com.finset.key_fin.furniture.entity.FurniturePlacementDirection;
import com.finset.key_fin.furniture.entity.FurniturePlacementStatus;
import com.finset.key_fin.furniture.entity.UserFurniture;
import com.finset.key_fin.item.entity.ItemSlotType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

@Schema(description = "방에 설치된 가구")
public record PlacedFurnitureResponse(
		@Schema(requiredMode = REQUIRED) Long userFurnitureId,
		@Schema(requiredMode = REQUIRED) Long itemId,
		@Schema(requiredMode = REQUIRED, allowableValues = {"FLOOR", "WALL"}) ItemSlotType slotType,
		@Schema(requiredMode = REQUIRED) String assetKey,
		@Schema(requiredMode = REQUIRED) FurniturePlacementStatus placementStatus,
		@Schema(requiredMode = REQUIRED) FurniturePlacementDirection placementDirection,
		@Schema(requiredMode = REQUIRED) BigDecimal positionX,
		@Schema(requiredMode = REQUIRED) BigDecimal positionY,
		@Schema(requiredMode = REQUIRED) int layer
) {
	public static PlacedFurnitureResponse from(UserFurniture furniture) {
		var item = furniture.getItem();
		return new PlacedFurnitureResponse(furniture.getId(), item.getId(), item.getSlotType(), item.getAssetKey(),
				furniture.getPlacementStatus(), furniture.getPlacementDirection(),
				furniture.getPositionX(), furniture.getPositionY(), furniture.getLayer());
	}
}
