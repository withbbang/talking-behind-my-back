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
	private Role role;
	private String content;
	private InputType inputType;
	private RoomMode mode;
	private String model;
	private Integer promptTokens;
	private Integer completionTokens;
	private LocalDateTime createdAt;

	public static Message user(Long roomId, Long senderUserId, String content, InputType inputType, RoomMode mode) {
		return Message.builder().roomId(roomId).senderUserId(senderUserId).role(Role.USER)
			.content(content).inputType(inputType).mode(mode).build();
	}

	public static Message assistant(Long roomId, String content, String model, Integer promptTokens, Integer completionTokens) {
		return Message.builder().roomId(roomId).role(Role.ASSISTANT).content(content)
			.model(model).promptTokens(promptTokens).completionTokens(completionTokens).build();
	}
}
