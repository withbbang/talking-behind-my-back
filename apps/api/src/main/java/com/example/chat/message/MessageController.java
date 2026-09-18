package com.example.chat.message;

import com.example.chat.auth.AuthPrincipal;
import com.example.chat.chatroom.RoomMemberMapper;
import com.example.chat.global.CursorPage;
import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** API.md#messages — 과거 조회 / 전송(202) / 방 이벤트 SSE (T-007, D-018). */
@RestController
@RequestMapping("/rooms/{roomId}")
public class MessageController {

	public static final int MAX_CONTENT = 4_000;

	public record SendRequest(@NotBlank @Size(max = MAX_CONTENT) String content, Message.InputType inputType) {
		Message.InputType inputTypeOrText() {
			return inputType == null ? Message.InputType.TEXT : inputType;
		}
	}

	private final MessageService service;
	private final RoomEventBus bus;
	private final RoomMemberMapper members;

	public MessageController(MessageService service, RoomEventBus bus, RoomMemberMapper members) {
		this.service = service;
		this.bus = bus;
		this.members = members;
	}

	@GetMapping("/messages")
	public CursorPage<MessageResponse> history(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable Long roomId,
		@RequestParam(required = false) String cursor, @RequestParam(required = false) Integer size) {
		return service.history(principal.userId(), roomId, cursor, size);
	}

	@PostMapping("/messages")
	@ResponseStatus(HttpStatus.ACCEPTED)
	public Map<String, Long> send(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable Long roomId,
		@RequestBody @Valid SendRequest body) {
		Long id = service.send(principal.userId(), roomId, body.content(), body.inputTypeOrText());
		return Map.of("messageId", id);
	}

	/** 멤버만. emitter 타임아웃 무제한 — 하트비트·끊김 처리는 RoomEventBus. */
	@GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
	public SseEmitter events(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable Long roomId) {
		members.findActive(roomId, principal.userId()).orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));
		return bus.subscribe(roomId, principal.userId());
	}
}
