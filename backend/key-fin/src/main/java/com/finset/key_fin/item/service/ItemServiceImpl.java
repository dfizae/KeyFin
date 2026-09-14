package com.finset.key_fin.item.service;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.global.exception.CommonErrorCode;
import com.finset.key_fin.item.dto.response.AvatarEquipmentResponse;
import com.finset.key_fin.item.dto.response.EquippedItemResponse;
import com.finset.key_fin.item.dto.response.UserItemResponse;
import com.finset.key_fin.item.entity.ItemSlotType;
import com.finset.key_fin.item.entity.UserItem;
import com.finset.key_fin.item.exception.ItemErrorCode;
import com.finset.key_fin.item.repository.UserItemRepository;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ItemServiceImpl implements ItemService {
	private final UserItemRepository userItemRepository;
	private final UserRepository userRepository;

	@Transactional(readOnly = true)
	@Override
	public List<UserItemResponse> getItems(long userId, String slotType) {
		ItemSlotType filter = parseAvatarSlot(slotType);
		validateActiveUser(userId);
		List<UserItem> items = filter == null
				? userItemRepository.findByUserIdOrderByIdAsc(userId)
				: userItemRepository.findByUserIdAndItemSlotTypeOrderByIdAsc(userId, filter);
		return items.stream().map(UserItemResponse::from).toList();
	}

	@Transactional(readOnly = true)
	@Override
	public AvatarEquipmentResponse getEquipment(long userId) {
		validateActiveUser(userId);
		return currentEquipment(userId);
	}

	@Transactional
	@Override
	public AvatarEquipmentResponse equip(long userId, long userItemId) {
		lockActiveUser(userId);
		UserItem target = findOwnedItem(userId, userItemId);
		if (!target.isEquipped()) {
			userItemRepository.findByUserIdAndEquippedSlot(userId, target.getItem().getSlotType())
					.ifPresent(previous -> {
						previous.unequip();
						// 기존 슬롯을 먼저 비워 Hibernate UPDATE 순서와 무관하게 유일 제약을 지킨다.
						userItemRepository.flush();
					});
			target.equip();
			userItemRepository.flush();
		}
		return currentEquipment(userId);
	}

	@Transactional
	@Override
	public AvatarEquipmentResponse unequip(long userId, long userItemId) {
		lockActiveUser(userId);
		UserItem target = findOwnedItem(userId, userItemId);
		if (target.isEquipped()) {
			target.unequip();
			userItemRepository.flush();
		}
		return currentEquipment(userId);
	}

	private AvatarEquipmentResponse currentEquipment(long userId) {
		return new AvatarEquipmentResponse(userItemRepository.findByUserIdAndEquippedSlotIsNotNull(userId)
				.stream()
				.sorted(Comparator.comparing(UserItem::getEquippedSlot))
				.map(EquippedItemResponse::from)
				.toList());
	}

	private UserItem findOwnedItem(long userId, long userItemId) {
		return userItemRepository.findByIdAndUserId(userItemId, userId)
				.orElseThrow(() -> new BusinessException(ItemErrorCode.USER_ITEM_NOT_FOUND));
	}

	private void validateActiveUser(long userId) {
		userRepository.findByIdAndDeletedAtIsNull(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
	}

	private void lockActiveUser(long userId) {
		// 아이템이 하나도 장착되지 않은 경우에도 사용자 단위로 모든 변경을 직렬화한다.
		userRepository.findActiveByIdForUpdate(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
	}

	private ItemSlotType parseAvatarSlot(String value) {
		if (value == null) {
			return null;
		}
		try {
			ItemSlotType slot = ItemSlotType.valueOf(value);
			if (slot.isAvatarSlot()) {
				return slot;
			}
		} catch (IllegalArgumentException ignored) {
			// 빈 값과 알 수 없는 유형도 동일한 입력 오류로 응답한다.
		}
		throw new BusinessException(CommonErrorCode.INVALID_INPUT_VALUE);
	}
}
