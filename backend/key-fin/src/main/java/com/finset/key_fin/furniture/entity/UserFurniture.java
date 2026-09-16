package com.finset.key_fin.furniture.entity;

import com.finset.key_fin.furniture.exception.FurnitureErrorCode;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.item.entity.Item;
import com.finset.key_fin.item.entity.ItemCategory;
import com.finset.key_fin.item.entity.ItemSlotType;
import com.finset.key_fin.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "user_furnitures")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserFurniture {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "item_id", nullable = false)
	private Item item;

	@Enumerated(EnumType.STRING)
	@Column(name = "placement_status", length = 20)
	private FurniturePlacementStatus placementStatus;

	@Enumerated(EnumType.STRING)
	@Column(name = "placement_direction", length = 20)
	private FurniturePlacementDirection placementDirection;

	@Column(name = "position_x", precision = 8, scale = 3)
	private BigDecimal positionX;

	@Column(name = "position_y", precision = 8, scale = 3)
	private BigDecimal positionY;

	@Column(nullable = false)
	private int layer;

	@Generated(event = EventType.INSERT)
	@Enumerated(EnumType.STRING)
	@Column(name = "item_category", nullable = false, insertable = false, updatable = false, length = 20)
	private ItemCategory itemCategory;

	@Generated(event = EventType.INSERT)
	@Column(name = "acquired_at", nullable = false, insertable = false, updatable = false)
	private LocalDateTime acquiredAt;

	public void place(FurniturePlacementStatus status, FurniturePlacementDirection direction,
			BigDecimal positionX, BigDecimal positionY, int layer) {
		boolean allowed = (item.getSlotType() == ItemSlotType.FLOOR && status == FurniturePlacementStatus.FLOOR)
				|| (item.getSlotType() == ItemSlotType.WALL
				&& (status == FurniturePlacementStatus.LEFT_WALL || status == FurniturePlacementStatus.RIGHT_WALL));
		if (!allowed) {
			throw new BusinessException(FurnitureErrorCode.PLACEMENT_NOT_ALLOWED);
		}
		this.placementStatus = status;
		this.placementDirection = direction;
		this.positionX = positionX;
		this.positionY = positionY;
		this.layer = layer;
	}

	public void unplace() {
		this.placementStatus = null;
		this.placementDirection = null;
		this.positionX = null;
		this.positionY = null;
		this.layer = 0;
	}

	public boolean isPlaced() {
		return placementStatus != null;
	}
}
