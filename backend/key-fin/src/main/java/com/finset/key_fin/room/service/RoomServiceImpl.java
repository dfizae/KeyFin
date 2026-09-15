package com.finset.key_fin.room.service;

import com.finset.key_fin.furniture.service.FurnitureService;
import com.finset.key_fin.item.service.ItemService;
import com.finset.key_fin.room.dto.response.RoomResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RoomServiceImpl implements RoomService {

	private final ItemService itemService;
	private final FurnitureService furnitureService;

	@Transactional(readOnly = true)
	@Override
	public RoomResponse getRoom(long userId) {
		// TODO: 사용자의 최신 FinCoin 원장에서 현재 잔액을 조회한다.
		// TODO: 오늘 ATTEND 사유의 FinCoin 원장이 존재하는지 조회한다.
		// TODO: Budget, BudgetEnvelope, Transaction 도메인의 계산 결과로 보드 요약을 구성한다.
		// TODO: 현재 아바타 반응 상태와 활성 방 테마를 조회한다.
		var equipped = itemService.getEquipment(userId).equipped();
		var furnitures = furnitureService.getPlacedFurnitures(userId);

		return new RoomResponse(
				new RoomResponse.AvatarResponse(equipped, null),
				furnitures,
				new RoomResponse.CoinResponse(1250),
				new RoomResponse.BoardResponse("202609", 36),
				new RoomResponse.AttendanceResponse(false)
		);
	}
}
