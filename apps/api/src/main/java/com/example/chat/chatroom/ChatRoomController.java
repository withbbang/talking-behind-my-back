package com.example.chat.chatroom;

import com.example.chat.auth.AuthPrincipal;
import com.example.chat.global.CursorPage;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * /rooms (API.md#rooms, T-006) + 초대 입장·재발급(T-016). mode/aiPersonality PATCH 는 T-017.
 * PATCH 는 title 만 받는다 — 다른 필드는 Jackson 이 무시(T-017 에서 추가).
 * `/rooms/join/{code}` 는 `/rooms/{id}` 보다 리터럴 세그먼트가 우선 매칭된다.
 */
@RestController
@RequestMapping("/rooms")
public class ChatRoomController {

	private final ChatRoomService service;

	public ChatRoomController(ChatRoomService service) {
		this.service = service;
	}

	public record CreateRequest(@Size(max = 100) String title) {
	}

	public record UpdateRequest(@NotBlank @Size(max = 100) String title) {
	}

	@GetMapping
	public CursorPage<RoomResponse> list(@AuthenticationPrincipal AuthPrincipal principal,
		@RequestParam(required = false) String cursor, @RequestParam(required = false) Integer size) {
		return service.list(principal.userId(), cursor, size);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public RoomResponse create(@AuthenticationPrincipal AuthPrincipal principal,
		@RequestBody(required = false) @Valid CreateRequest body) {
		return service.create(principal.userId(), body == null ? null : body.title());
	}

	@GetMapping("/{id}")
	public RoomResponse get(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable Long id) {
		return service.get(principal.userId(), id);
	}

	@PatchMapping("/{id}")
	public RoomResponse update(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable Long id,
		@RequestBody @Valid UpdateRequest body) {
		return service.updateTitle(principal.userId(), id, body.title());
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void leave(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable Long id) {
		service.leave(principal.userId(), id);
	}

	@PostMapping("/{id}/invite/regenerate")
	public InviteResponse regenerateInvite(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable Long id) {
		return service.regenerateInvite(principal.userId(), id);
	}

	@GetMapping("/join/{code}")
	public JoinPreviewResponse preview(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable String code) {
		return service.preview(principal.userId(), code);
	}

	@PostMapping("/join/{code}")
	public RoomResponse join(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable String code) {
		return service.join(principal.userId(), code);
	}
}
