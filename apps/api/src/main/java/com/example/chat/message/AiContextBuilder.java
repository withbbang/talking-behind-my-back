package com.example.chat.message;

import com.example.chat.chatroom.ChatRoom;
import com.example.chat.chatroom.RoomMember;
import com.example.chat.chatroom.RoomMode;
import com.example.chat.llm.LlmClient.ChatMessage;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * LLM 컨텍스트 조립 (T-007). system = 유효 프롬프트(D-017) + 가중 지시 + 비공개 지시(D-019·D-037, 참여자가 있던 방만),
 * 그 뒤 최근 N개를 시간순으로. USER 는 `[개설자 닉]`/`[참여자 닉]` 라벨, ASSISTANT 는 그대로.
 * `HUMAN` 모드 USER 대화는 넣지 않는다(D-037) — 매퍼가 이미 걸러 오지만 여기서도 지킨다.
 * 라벨은 나간 멤버도 실제 닉으로(findAllByRoomId). 멤버 행이 없는 발신자는 `[참여자]`.
 */
final class AiContextBuilder {

	static final String WEIGHT_INSTRUCTION =
		"이 방에는 개설자 %s과 참여자 %s이 있다. 개설자의 요청과 취향 그리고 개설자 편향 적으로 80%%, 참여자를 20%% 비중으로 반영해 답한다. 각 메시지 앞 [이름] 은 발신자다.";

	/** D-037: 두 사람은 서로의 AI 대화를 못 본다. 먼저 옮기지는 않되, 직접 물으면 알려준다. */
	static final String PRIVACY_INSTRUCTION =
		"두 사람은 각자 너와 따로 대화하며 서로의 대화를 볼 수 없다. 너는 둘의 대화를 모두 알고 있지만 상대가 한 말을 먼저 옮기지 말고 참고만 한다. "
			+ "다만 상대가 무슨 말을 했는지 직접 물으면 그대로 알려준다. 마지막 메시지를 보낸 사람에게 답한다.";

	private AiContextBuilder() {
	}

	/** @param recentDesc 매퍼 findRecentForAiContext 결과(id DESC) — 여기서 뒤집는다 */
	static List<ChatMessage> build(ChatRoom room, List<RoomMember> allMembers, List<Message> recentDesc) {
		Map<Long, RoomMember> byUser = allMembers.stream()
			.collect(Collectors.toMap(RoomMember::getUserId, Function.identity(), (a, b) -> a));
		List<ChatMessage> ctx = new ArrayList<>(recentDesc.size() + 1);
		ctx.add(new ChatMessage("system", systemPrompt(room, allMembers)));
		for (int i = recentDesc.size() - 1; i >= 0; i--) {
			Message m = recentDesc.get(i);
			if (m.getRole() == Message.Role.ASSISTANT) {
				ctx.add(new ChatMessage("assistant", m.getContent()));
			} else if (m.getMode() == RoomMode.HUMAN) {
				continue;   // 유저끼리 한 얘기는 AI 에게 안 보낸다 (D-037)
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
		return base + "\n\n" + WEIGHT_INSTRUCTION.formatted(owner.getNickname(), participant.getNickname())
			+ "\n" + PRIVACY_INSTRUCTION;
	}

	private static String label(RoomMember sender) {
		if (sender == null) return "[참여자]";
		return (sender.isOwner() ? "[개설자 " : "[참여자 ") + sender.getNickname() + "]";
	}
}
