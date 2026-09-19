package com.finset.key_fin.furniture.entity;

import java.math.BigDecimal;

public enum DefaultFurnitureType {

	FRIDGE("280.438", "217.813"),
	SOFA("164.875", "226.000"),
	TV("172.719", "176.094");

	private final BigDecimal initialX;
	private final BigDecimal initialY;

	DefaultFurnitureType(String initialX, String initialY) {
		this.initialX = new BigDecimal(initialX);
		this.initialY = new BigDecimal(initialY);
	}

	public void placeInitially(UserFurniture furniture) {
		furniture.place(FurniturePlacementStatus.FLOOR, FurniturePlacementDirection.FRONT_RIGHT,
				initialX, initialY, 0);
	}
}
