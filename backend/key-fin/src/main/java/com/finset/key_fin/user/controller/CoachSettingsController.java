package com.finset.key_fin.user.controller;

import com.finset.key_fin.user.dto.request.CoachPersonaUpdateRequest;
import com.finset.key_fin.user.service.CoachSettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@RestController
@RequestMapping("/api/v1/settings/coach")
@RequiredArgsConstructor
public class CoachSettingsController implements CoachSettingsControllerDocs {

	private final CoachSettingsService coachSettingsService;

	@PutMapping(consumes = APPLICATION_JSON_VALUE)
	@Override
	public ResponseEntity<Void> updateCoachPersona(
			@AuthenticationPrincipal Long userId,
			@Valid @RequestBody CoachPersonaUpdateRequest request
	) {
		coachSettingsService.updateCoachPersona(userId, request);
		return ResponseEntity.ok().build();
	}
}
