package com.example.chat.message;

import com.example.chat.chatroom.ChatRoom;
import com.example.chat.chatroom.RoomMember;
import com.example.chat.llm.LlmClient.ChatMessage;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * LLM 컨텍스트 조립 (T-007). system = 유효 프롬프트(D-017) + 가중 지시(D-019, 참여자가 있던 방만),
 * 그 뒤 최근 N개를 시간순으로. USER 는 `[개설자 닉]`/`[참여자 닉]` 라벨(HUMAN 모드 대화 포함), ASSISTANT 는 그대로.
 * 라벨은 나간 멤버도 실제 닉으로(findAllByRoomId). 멤버 행이 없는 발신자는 `[참여자]`.
 */
final class AiContextBuilder {

	static final String WEIGHT_INSTRUCTION =
		"이 방에는 개설자 %s과 참여자 %s이 있다. 개설자의 요청과 취향 그리고 개설자 편향 적으로 80%%, 참여자를 20%% 비중으로 반영해 답한다. 각 메시지 앞 [이름] 은 발신자다.";

	private AiContextBuilder() {
	}

	/** @param recentDesc 매퍼 findRecentByRoomId 결과(id DESC) — 여기서 뒤집는다 */
	static List<ChatMessage> build(ChatRoom room, List<RoomMember> allMembers, List<Message> recentDesc) {
		Map<Long, RoomMember> byUser = allMembers.stream()
			.collect(Collectors.toMap(RoomMember::getUserId, Function.identity(), (a, b) -> a));
		List<ChatMessage> ctx = new ArrayList<>(recentDesc.size() + 1);
		ctx.add(new ChatMessage("system", systemPrompt(room, allMembers)));
		for (int i = recentDesc.size() - 1; i >= 0; i--) {
			Message m = recentDesc.get(i);
			if (m.getRole() == Message.Role.ASSISTANT) {
				ctx.add(new ChatMessage("assistant", m.getContent()));
			} else {
				ctx.add(new ChatMessage("user", label(byUser.get(m.getSenderUserId())) + " " + m.getContent()));
			}
		}
		return ctx;
	}

	private static String systemPrompt(ChatRoom room, List<RoomMember> allMembers) {
		String base = room.effectiveAiPrompt();
		RoomMember owner = null;
		RoomMember participant = null;
		for (RoomMember m : allMembers) {
			if (m.isOwner()) owner = m;
			else if (participant == null) participant = m;   // 여러 명이면 첫 참여자(방은 2인 상한)
		}
		if (owner == null || participant == null) return base;
		return base + "\n\n" + WEIGHT_INSTRUCTION.formatted(owner.getNickname(), participant.getNickname());
	}

	private static String label(RoomMember sender) {
		if (sender == null) return "[참여자]";
		return (sender.isOwner() ? "[개설자 " : "[참여자 ") + sender.getNickname() + "]";
	}
}
