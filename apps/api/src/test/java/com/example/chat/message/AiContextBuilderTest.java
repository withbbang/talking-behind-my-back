package com.example.chat.message;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.chat.chatroom.AiPersonality;
import com.example.chat.chatroom.ChatRoom;
import com.example.chat.chatroom.RoomMember;
import com.example.chat.chatroom.RoomMode;
import com.example.chat.llm.LlmClient.ChatMessage;
import java.util.List;
import org.junit.jupiter.api.Test;

/** T-007 컨텍스트 조립 (D-017 유효 프롬프트 + D-019 가중 지시 + 최근 N 라벨) + T-031 비공개 규칙(D-037). 순수 로직 — 스프링 없음. */
class AiContextBuilderTest {

	private static final long OWNER = 1L;
	private static final long GUEST = 2L;

	private static ChatRoom room(String aiPrompt) {
		return ChatRoom.builder().id(10L).ownerId(OWNER).aiPersonality(AiPersonality.EMOTIONAL).aiPrompt(aiPrompt).build();
	}

	private static RoomMember member(long userId, RoomMember.Role role, String nickname) {
		RoomMember m = role == RoomMember.Role.OWNER ? RoomMember.owner(10L, userId) : RoomMember.participant(10L, userId);
		m.setNickname(nickname);
		return m;
	}

	private static Message user(long id, long sender, String content, RoomMode mode) {
		Message m = Message.user(10L, sender, content, Message.InputType.TEXT, mode);
		m.setId(id);
		return m;
	}

	private static Message assistant(long id, String content) {
		Message m = Message.assistant(10L, OWNER, content, "m", 1, 1);
		m.setId(id);
		return m;
	}

	private final List<RoomMember> twoMembers = List.of(
		member(OWNER, RoomMember.Role.OWNER, "철수"), member(GUEST, RoomMember.Role.PARTICIPANT, "영희"));

	@Test
	void 시스템_프롬프트는_유효_프롬프트_뒤에_가중_지시_그리고_최근_N을_시간순으로_라벨_붙여() {
		// 매퍼는 id DESC 로 준다
		List<Message> recentDesc = List.of(
			assistant(4, "반가워요"),
			user(3, GUEST, "나도 안녕", RoomMode.HUMAN),
			user(2, OWNER, "안녕", RoomMode.AI));

		List<ChatMessage> ctx = AiContextBuilder.build(room("너는 고양이다"), twoMembers, recentDesc);

		assertThat(ctx).hasSize(3);
		assertThat(ctx.get(0).role()).isEqualTo("system");
		assertThat(ctx.get(0).content()).startsWith("너는 고양이다");
		assertThat(ctx.get(0).content()).contains("개설자 철수").contains("참여자 영희")
			.contains("개설자의 요청과 취향 그리고 개설자 편향 적으로 80%, 참여자를 20% 비중으로 반영해 답한다.")
			.contains("[이름]");
		assertThat(ctx.get(1)).isEqualTo(new ChatMessage("user", "[개설자 철수] 안녕"));
		assertThat(ctx.get(2)).isEqualTo(new ChatMessage("assistant", "반가워요"));
	}

	@Test
	void HUMAN_모드_USER_대화는_컨텍스트에서_빠진다() {
		List<Message> recentDesc = List.of(
			user(3, GUEST, "AI 몰래 한 말", RoomMode.HUMAN),
			user(2, OWNER, "나도 몰래", RoomMode.HUMAN),
			user(1, OWNER, "AI 랑 한 말", RoomMode.AI));

		List<ChatMessage> ctx = AiContextBuilder.build(room(null), twoMembers, recentDesc);

		assertThat(ctx).hasSize(2);
		assertThat(ctx.get(1)).isEqualTo(new ChatMessage("user", "[개설자 철수] AI 랑 한 말"));
	}

	@Test
	void 두_사람_방이면_비공개_지시가_붙는다() {
		String system = AiContextBuilder.build(room(null), twoMembers, List.of()).get(0).content();

		assertThat(system).contains(AiContextBuilder.PRIVACY_INSTRUCTION);
	}

	@Test
	void 혼자인_방은_비공개_지시도_없다() {
		List<RoomMember> onlyOwner = List.of(member(OWNER, RoomMember.Role.OWNER, "철수"));

		String system = AiContextBuilder.build(room(null), onlyOwner, List.of()).get(0).content();

		assertThat(system).doesNotContain(AiContextBuilder.PRIVACY_INSTRUCTION);
	}

	@Test
	void 커스텀_프롬프트_없으면_프리셋_문구() {
		List<ChatMessage> ctx = AiContextBuilder.build(room(null), twoMembers, List.of());

		assertThat(ctx).hasSize(1);
		assertThat(ctx.get(0).content()).startsWith(AiPersonality.EMOTIONAL.systemPrompt());
	}

	@Test
	void 참여자가_한_번도_없던_방은_가중_지시_없이_개설자_라벨만() {
		List<RoomMember> onlyOwner = List.of(member(OWNER, RoomMember.Role.OWNER, "철수"));

		List<ChatMessage> ctx = AiContextBuilder.build(room(null), onlyOwner, List.of(user(1, OWNER, "혼잣말", RoomMode.AI)));

		assertThat(ctx.get(0).content()).isEqualTo(AiPersonality.EMOTIONAL.systemPrompt());
		assertThat(ctx.get(1).content()).isEqualTo("[개설자 철수] 혼잣말");
	}

	@Test
	void 나간_멤버의_메시지도_실제_닉으로_라벨() {
		RoomMember left = member(GUEST, RoomMember.Role.PARTICIPANT, "영희");
		left.setLeftAt(java.time.LocalDateTime.now());
		List<RoomMember> members = List.of(member(OWNER, RoomMember.Role.OWNER, "철수"), left);

		List<ChatMessage> ctx = AiContextBuilder.build(room(null), members, List.of(user(1, GUEST, "잘 있어", RoomMode.AI)));

		assertThat(ctx.get(1).content()).isEqualTo("[참여자 영희] 잘 있어");
	}

	@Test
	void 발신자를_모르면_역할만_라벨() {
		List<ChatMessage> ctx = AiContextBuilder.build(room(null), twoMembers, List.of(user(1, 99L, "누구?", RoomMode.AI)));

		assertThat(ctx.get(1).content()).isEqualTo("[참여자] 누구?");
	}
}
