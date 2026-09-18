package com.example.chat.message;

import com.example.chat.chatroom.RoomMode;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * messages (SCHEMA.md #5). id 가 커서 페이징 키. 오디오 원본은 저장하지 않는다(D-007).
 * senderUserId/mode 는 USER 만(2인 방 발신자·발신 당시 모드, V2). ASSISTANT 는 둘 다 null.
 * visibleToUserId 는 가시성(V4, D-037) — null 이면 방 전원, 값이 있으면 그 유저만 본다.
 * `AI` 모드는 각자 AI 와 1:1 이라 USER 는 발신자, 그 응답 ASSISTANT 는 물어본 유저. `HUMAN` 모드 대화는 null.
 * senderNickname 은 조회 시점 users.nickname(D-023) — 나간 멤버도 유지.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Message {

	public enum Role { USER, ASSISTANT }

	/** USER 메시지에만. VOICE = STT 로 입력된 메시지 */
	public enum InputType { TEXT, VOICE }

	private Long id;
	private Long roomId;
	private Long senderUserId;
	/** 조회 전용 — users 조인으로 채움(T-021, D-023). insert 에는 쓰이지 않는다. USER 만, users 행이 없으면 null. */
	private String senderNickname;
	private Role role;
	private String content;
	private InputType inputType;
	private RoomMode mode;
	/** null = 방 전원, 값 = 그 유저만 (V4, D-037) */
	private Long visibleToUserId;
	private String model;
	private Integer promptTokens;
	private Integer completionTokens;
	private LocalDateTime createdAt;

	/** `AI` 모드면 발신자에게만 보인다(D-037). `HUMAN` 모드는 방 전원. */
	public static Message user(Long roomId, Long senderUserId, String content, InputType inputType, RoomMode mode) {
		return Message.builder().roomId(roomId).senderUserId(senderUserId).role(Role.USER)
			.content(content).inputType(inputType).mode(mode)
			.visibleToUserId(mode == RoomMode.AI ? senderUserId : null).build();
	}

	/** @param askedByUserId 트리거 USER 메시지의 발신자 — 이 응답을 볼 수 있는 유일한 사람(D-037) */
	public static Message assistant(Long roomId, Long askedByUserId, String content, String model,
		Integer promptTokens, Integer completionTokens) {
		return Message.builder().roomId(roomId).role(Role.ASSISTANT).content(content).visibleToUserId(askedByUserId)
			.model(model).promptTokens(promptTokens).completionTokens(completionTokens).build();
	}
}
