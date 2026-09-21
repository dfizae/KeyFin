package com.finset.key_fin.room.service;

import com.finset.key_fin.budget.service.BudgetOverrunService;
import com.finset.key_fin.furniture.entity.DefaultFurnitureType;
import com.finset.key_fin.furniture.entity.UserFurniture;
import com.finset.key_fin.furniture.exception.FurnitureErrorCode;
import com.finset.key_fin.furniture.repository.UserFurnitureRepository;
import com.finset.key_fin.furniture.service.DefaultFurnitureService;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.room.dto.response.StickerRemovalResponse;
import com.finset.key_fin.room.dto.response.StickerStatusResponse;
import com.finset.key_fin.room.exception.RoomErrorCode;
import com.finset.key_fin.room.repository.RoomStickerRepository;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomStickerService {
	private static final ZoneId KST = ZoneId.of("Asia/Seoul");
	private final UserRepository users;
	private final UserFurnitureRepository furnitures;
	private final DefaultFurnitureService defaults;
	private final BudgetOverrunService budgets;
	private final RoomStickerRepository stickers;
	private final EntityManager entityManager;
	private final Clock clock;

	@Transactional
	public StickerStatusResponse synchronize(long userId) {
		lockUser(userId);
		LocalDateTime now = LocalDateTime.now(clock.withZone(KST));
		var targets = synchronizeLocked(userId, now);
		return status(userId, targets, now.toLocalDate());
	}

	@Transactional
	public StickerRemovalResponse remove(long userId, long userFurnitureId) {
		lockUser(userId);
		var target = furnitures.findByIdAndUserId(userFurnitureId, userId)
				.orElseThrow(() -> new BusinessException(FurnitureErrorCode.USER_FURNITURE_NOT_FOUND));
		if (target.canUnplace()) {
			throw new BusinessException(RoomErrorCode.NOT_STICKER_TARGET);
		}
		LocalDateTime now = LocalDateTime.now(clock.withZone(KST));
		LocalDate today = now.toLocalDate();
		if (removedToday(userId, today)) {
			throw new BusinessException(RoomErrorCode.ALREADY_REMOVED_TODAY);
		}
		var targets = synchronizeLocked(userId, now);
		if (!target.isStickerAttached()) {
			throw new BusinessException(RoomErrorCode.STICKER_NOT_ATTACHED);
		}
		target.removeSticker();
		stickers.recordRemoval(userId, today);
		return new StickerRemovalResponse(userFurnitureId, false, status(userId, targets, today));
	}

	private List<UserFurniture> synchronizeLocked(long userId, LocalDateTime now) {
		var targets = defaults.provision(userId);
		// JDBC aggregation must see pending JPA classifications and budget confirmation.
		entityManager.flush();
		budgets.currentExceededBudgetId(userId, now.toLocalDate()).ifPresent(budgetId -> {
			if (!stickers.wasApplied(budgetId)) {
				stickers.recordApplication(userId, budgetId, now);
				targets.forEach(UserFurniture::attachSticker);
			}
		});
		return targets;
	}

	private StickerStatusResponse status(long userId, List<UserFurniture> targets, LocalDate today) {
		int count = (int) targets.stream().filter(UserFurniture::isStickerAttached).count();
		return new StickerStatusResponse(count, DefaultFurnitureType.values().length,
				count > 0 && !removedToday(userId, today));
	}

	private boolean removedToday(long userId, LocalDate today) {
		return stickers.lastRemovedDate(userId).filter(today::equals).isPresent();
	}

	private void lockUser(long userId) {
		users.findActiveByIdForUpdate(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
	}
}
