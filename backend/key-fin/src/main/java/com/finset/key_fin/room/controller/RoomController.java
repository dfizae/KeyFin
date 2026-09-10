package com.finset.key_fin.room.controller;

import com.finset.key_fin.global.base.BaseResponse;
import com.finset.key_fin.room.dto.response.RoomResponse;
import com.finset.key_fin.room.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/room")
@RequiredArgsConstructor
public class RoomController implements RoomControllerDocs {

	private final RoomService roomService;

	@GetMapping
	@Override
	public BaseResponse<RoomResponse> getRoom(@AuthenticationPrincipal Long userId) {
		return BaseResponse.ok(roomService.getRoom(userId));
	}
}
