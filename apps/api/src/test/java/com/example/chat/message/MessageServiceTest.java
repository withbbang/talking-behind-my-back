package com.example.chat.message;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.chat.chatroom.ChatRoom;
import com.example.chat.chatroom.ChatRoomMapper;
import com.example.chat.chatroom.InviteCodes;
import com.example.chat.chatroom.RoomMember;
import com.example.chat.chatroom.RoomMemberMapper;
import com.example.chat.chatroom.RoomMode;
import com.example.chat.chatroom.RoomStatus;
import com.example.chat.global.AppProperties;
import com.example.chat.global.CursorPage;
import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import com.example.chat.llm.LlmClient.ChatMessage;
import com.example.chat.user.User;
import com.example.chat.user.UserMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

/**
 * T-007 전송·AI 잡·컨텍스트·사용량·과거 조회 + T-031 가시성(D-037). 실제 매퍼 위에서 @Transactional 롤백.
 * AI 잡은 SyncAiTestConfig 로 동기 실행(같은 트랜잭션), OmniRoute 는 FakeLlm. SSE 는 EventRecorder 로 수신 확인.
 * `events` = 개설자 구독, `guestEvents` = 참여자 구독 — AI 모드 이벤트가 상대에게 새지 않는지 본다.
 */
@SpringBootTest
@Import(SyncAiTestConfig.class)
@Transactional
class MessageServiceTest {

	@Autowired MessageService service;
	@Autowired MessageMapper messageMapper;
	@Autowired ChatRoomMapper roomMapper;
	@Autowired RoomMemberMapper memberMapper;
	@Autowired DailyUsageMapper usageMapper;
	@Autowired UserMapper userMapper;
	@Autowired RoomEventBus bus;
	@Autowired SyncAiTestConfig.FakeLlm llm;
	@Autowired AppProperties appProps;

	private User owner;
	private User guest;
	private ChatRoom room;
	private EventRecorder events;
	private EventRecorder guestEvents;

	@BeforeEach
	void setUp() {
		llm.reset();
		owner = newUser("철수");
		guest = newUser("영희");
		room = newRoom(owner.getId(), null);
		events = new EventRecorder();
		guestEvents = new EventRecorder();
		bus.subscribe(room.getId(), owner.getId(), events.emitter);
		bus.subscribe(room.getId(), guest.getId(), guestEvents.emitter);
	}

	private User newUser(String nickname) {
		User u = User.builder().nickname(nickname).build();
		userMapper.insert(u);
		return u;
	}

	private ChatRoom newRoom(Long ownerId, String title) {
		ChatRoom r = ChatRoom.create(ownerId, title, InviteCodes.generate());
		roomMapper.insert(r);
		memberMapper.insert(RoomMember.owner(r.getId(), ownerId));
		return r;
	}

	private void joinGuest() {
		memberMapper.insert(RoomMember.participant(room.getId(), guest.getId()));
	}

	private void setHuman() {
		joinGuest();
		roomMapper.updateMode(room.getId(), RoomMode.HUMAN);
	}

	private LocalDate today() {
		return LocalDate.now(appProps.zoneId());
	}

	private static void assertError(ThrowingCallable call, ErrorCode code) {
		assertThatThrownBy(call).isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(code);
	}

	@Nested
	@DisplayName("send — 공통")
	class SendCommon {

		@Test
		void 비멤버는_404_나간_멤버도_404() {
			assertError(() -> service.send(guest.getId(), room.getId(), "hi", Message.InputType.TEXT), ErrorCode.ROOM_NOT_FOUND);
			joinGuest();
			memberMapper.leave(room.getId(), guest.getId());
			assertError(() -> service.send(guest.getId(), room.getId(), "hi", Message.InputType.TEXT), ErrorCode.ROOM_NOT_FOUND);
			assertThat(messageMapper.countByRoomId(room.getId())).isZero();
		}

		@Test
		void ORPHANED_방은_410() {
			joinGuest();
			roomMapper.updateStatus(room.getId(), RoomStatus.ORPHANED);
			assertError(() -> service.send(guest.getId(), room.getId(), "hi", Message.InputType.TEXT), ErrorCode.ROOM_ORPHANED);
		}

		@Test
		void 첫_메시지면_기본_제목을_앞_30자로_바꾸고_두_번째는_안_바꾼다() {
			setHuman();
			String first = "가나다라마바사아자차카타파하 가나다라마바사아자차카타파하 더 길게";
			service.send(owner.getId(), room.getId(), first, Message.InputType.TEXT);
			assertThat(roomMapper.findById(room.getId()).orElseThrow().getTitle()).isEqualTo(ChatRoom.autoTitle(first)).hasSize(30);

			service.send(guest.getId(), room.getId(), "두 번째", Message.InputType.TEXT);
			assertThat(roomMapper.findById(room.getId()).orElseThrow().getTitle()).isEqualTo(ChatRoom.autoTitle(first));
		}

		@Test
		void 제목을_직접_정한_방은_첫_메시지여도_안_바꾼다() {
			ChatRoom named = newRoom(owner.getId(), "내 방");
			roomMapper.updateMode(named.getId(), RoomMode.AI);
			llm.reply("ok");
			service.send(owner.getId(), named.getId(), "안녕", Message.InputType.TEXT);
			assertThat(roomMapper.findById(named.getId()).orElseThrow().getTitle()).isEqualTo("내 방");
		}
	}

	@Nested
	@DisplayName("send — HUMAN 모드")
	class SendHuman {

		@Test
		void USER_저장_mode_HUMAN_message_브로드캐스트_AI_호출_없음_사용량_카운트() {
			setHuman();

			Long id = service.send(guest.getId(), room.getId(), "사람끼리", Message.InputType.VOICE);

			Message saved = messageMapper.findById(id).orElseThrow();
			assertThat(saved.getRole()).isEqualTo(Message.Role.USER);
			assertThat(saved.getSenderUserId()).isEqualTo(guest.getId());
			assertThat(saved.getMode()).isEqualTo(RoomMode.HUMAN);
			assertThat(saved.getInputType()).isEqualTo(Message.InputType.VOICE);
			assertThat(saved.getVisibleToUserId()).isNull();   // 방 전원 공개 (D-037)

			assertThat(events.names()).containsExactly("message");          // 상대(개설자)도 받는다
			assertThat(guestEvents.names()).containsExactly("message");     // 발신자 자신도 받는다
			MessageResponse m = (MessageResponse) events.last().data();
			assertThat(m.id()).isEqualTo(id);
			assertThat(m.content()).isEqualTo("사람끼리");
			assertThat(m.senderUserId()).isEqualTo(guest.getId());
			assertThat(m.createdAt()).isInstanceOf(Instant.class);

			assertThat(llm.calls).isEmpty();
			assertThat(usageMapper.find(guest.getId(), today()).orElseThrow().getMessageCount()).isEqualTo(1);
			assertThat(usageMapper.find(owner.getId(), today())).isEmpty();
			ChatRoom r = roomMapper.findById(room.getId()).orElseThrow();
			assertThat(r.getMessageCount()).isEqualTo(1);
			assertThat(r.getLastMessageAt()).isAfterOrEqualTo(r.getCreatedAt());
		}
	}

	@Nested
	@DisplayName("send — AI 모드")
	class SendAi {

		@Test
		void message_delta_done_순서로_흘리고_ASSISTANT_저장_토큰은_발신자_귀속() {
			llm.replyWithUsage(320, 18, "안녕", "하세요");

			Long userId = service.send(owner.getId(), room.getId(), "안녕", Message.InputType.TEXT);

			assertThat(events.names()).containsExactly("message", "delta", "delta", "done");
			assertThat(events.events.get(1).data()).isEqualTo(Map.of("replyTo", userId, "text", "안녕"));
			assertThat(events.events.get(2).data()).isEqualTo(Map.of("replyTo", userId, "text", "하세요"));
			@SuppressWarnings("unchecked")
			Map<String, Object> done = (Map<String, Object>) events.last().data();
			assertThat(done.get("replyTo")).isEqualTo(userId);
			assertThat(done.get("promptTokens")).isEqualTo(320);
			assertThat(done.get("completionTokens")).isEqualTo(18);
			MessageResponse assistant = (MessageResponse) done.get("message");
			assertThat(assistant.role()).isEqualTo(Message.Role.ASSISTANT);
			assertThat(assistant.content()).isEqualTo("안녕하세요");
			assertThat(assistant.senderUserId()).isNull();
			assertThat(assistant.mode()).isNull();

			Message saved = messageMapper.findById(assistant.id()).orElseThrow();
			assertThat(saved.getModel()).isEqualTo("fake-model");
			assertThat(saved.getPromptTokens()).isEqualTo(320);
			assertThat(saved.getCompletionTokens()).isEqualTo(18);
			assertThat(messageMapper.countByRoomId(room.getId())).isEqualTo(2);
			assertThat(roomMapper.findById(room.getId()).orElseThrow().getMessageCount()).isEqualTo(2);
			assertThat(messageMapper.findById(userId).orElseThrow().getVisibleToUserId()).isEqualTo(owner.getId());
			assertThat(saved.getVisibleToUserId()).isEqualTo(owner.getId());   // AI 응답도 물어본 사람 것 (D-037)
			assertThat(guestEvents.events).isEmpty();                          // 상대 화면엔 아무것도 안 뜬다

			DailyUsage usage = usageMapper.find(owner.getId(), today()).orElseThrow();
			assertThat(usage.getMessageCount()).isEqualTo(1);
			assertThat(usage.getPromptTokens()).isEqualTo(320);
			assertThat(usage.getCompletionTokens()).isEqualTo(18);
		}

		@Test
		void 컨텍스트는_유효_프롬프트_라벨_최근_N_시간순_방금_보낸_메시지_포함() {
			joinGuest();
			roomMapper.updateAiPrompt(room.getId(), "너는 고양이다");
			llm.reply("야옹").reply("냐옹");

			service.send(owner.getId(), room.getId(), "첫 질문", Message.InputType.TEXT);
			service.send(guest.getId(), room.getId(), "둘째 질문", Message.InputType.TEXT);

			List<ChatMessage> second = llm.calls.get(1);
			assertThat(second.get(0).role()).isEqualTo("system");
			assertThat(second.get(0).content()).startsWith("너는 고양이다").contains("개설자 철수").contains("참여자 영희");
			assertThat(second.subList(1, second.size())).containsExactly(
				new ChatMessage("user", "[개설자 철수] 첫 질문"),
				new ChatMessage("assistant", "야옹"),
				new ChatMessage("user", "[참여자 영희] 둘째 질문"));
		}

		@Test
		void 컨텍스트는_최근_N개로_자른다() {
			int n = 30;
			for (int i = 0; i < n + 5; i++) {
				messageMapper.insert(Message.user(room.getId(), owner.getId(), "m" + i, Message.InputType.TEXT, RoomMode.AI));
			}
			llm.reply("ok");

			service.send(owner.getId(), room.getId(), "마지막", Message.InputType.TEXT);

			List<ChatMessage> ctx = llm.calls.get(0);
			assertThat(ctx).hasSize(n + 1);
			assertThat(ctx.get(ctx.size() - 1).content()).isEqualTo("[개설자 철수] 마지막");
			assertThat(ctx.get(1).content()).isEqualTo("[개설자 철수] m6");
		}

		@Test
		void 상류_실패는_error_이벤트_ASSISTANT_미저장_토큰_미집계() {
			llm.fail("boom");

			Long userId = service.send(owner.getId(), room.getId(), "안녕", Message.InputType.TEXT);

			assertThat(events.names()).containsExactly("message", "error");
			@SuppressWarnings("unchecked")
			Map<String, Object> err = (Map<String, Object>) events.last().data();
			assertThat(err.get("replyTo")).isEqualTo(userId);
			assertThat(err.get("code")).isEqualTo("LLM_UPSTREAM_ERROR");
			assertThat(err.get("message")).isEqualTo(ErrorCode.LLM_UPSTREAM_ERROR.getDefaultMessage());
			assertThat(messageMapper.countByRoomId(room.getId())).isEqualTo(1);
			assertThat(usageMapper.find(owner.getId(), today()).orElseThrow().getPromptTokens()).isZero();
			assertThat(guestEvents.events).isEmpty();   // error 도 물어본 사람에게만 (D-037)
		}

		@Test
		void 빈_응답도_error_로_처리() {
			llm.reply();

			service.send(owner.getId(), room.getId(), "안녕", Message.InputType.TEXT);

			assertThat(events.names()).containsExactly("message", "error");
			assertThat(messageMapper.countByRoomId(room.getId())).isEqualTo(1);
		}

		@Test
		void 잡_시작_시_방이_HUMAN_이면_건너뛴다() {
			joinGuest();
			Message m = Message.user(room.getId(), owner.getId(), "대기 중", Message.InputType.TEXT, RoomMode.AI);
			messageMapper.insert(m);
			roomMapper.updateMode(room.getId(), RoomMode.HUMAN);

			service.runAiJob(room.getId(), m.getId(), owner.getId());

			assertThat(llm.calls).isEmpty();
			assertThat(events.events).isEmpty();
			assertThat(messageMapper.countByRoomId(room.getId())).isEqualTo(1);
		}
	}

	@Nested
	@DisplayName("가시성 (D-037)")
	class Visibility {

		@Test
		void 상대의_AI_모드_질문과_답은_내_history_에_안_나온다() {
			joinGuest();
			llm.reply("내 답").reply("상대 답");
			Long mine = service.send(owner.getId(), room.getId(), "내 질문", Message.InputType.TEXT);
			Long yours = service.send(guest.getId(), room.getId(), "상대 질문", Message.InputType.TEXT);

			List<MessageResponse> ownerSees = service.history(owner.getId(), room.getId(), null, 20).items();
			assertThat(ownerSees).extracting(MessageResponse::content).containsExactly("내 답", "내 질문");
			assertThat(ownerSees).extracting(MessageResponse::id).doesNotContain(yours);

			List<MessageResponse> guestSees = service.history(guest.getId(), room.getId(), null, 20).items();
			assertThat(guestSees).extracting(MessageResponse::content).containsExactly("상대 답", "상대 질문");
			assertThat(guestSees).extracting(MessageResponse::id).doesNotContain(mine);
		}

		@Test
		void HUMAN_모드_대화는_양쪽_history_에_다_나온다() {
			setHuman();
			service.send(owner.getId(), room.getId(), "둘만 아는 얘기", Message.InputType.TEXT);

			assertThat(service.history(guest.getId(), room.getId(), null, 20).items())
				.extracting(MessageResponse::content).containsExactly("둘만 아는 얘기");
			assertThat(service.history(owner.getId(), room.getId(), null, 20).items())
				.extracting(MessageResponse::content).containsExactly("둘만 아는 얘기");
		}

		@Test
		void 커서_페이징은_내가_볼_수_있는_것만_세서_이어진다() {
			joinGuest();
			for (int i = 0; i < 4; i++) {
				messageMapper.insert(Message.user(room.getId(), owner.getId(), "내 " + i, Message.InputType.TEXT, RoomMode.AI));
				messageMapper.insert(Message.user(room.getId(), guest.getId(), "상대 " + i, Message.InputType.TEXT, RoomMode.AI));
			}

			CursorPage<MessageResponse> p1 = service.history(owner.getId(), room.getId(), null, 2);
			assertThat(p1.items()).extracting(MessageResponse::content).containsExactly("내 3", "내 2");
			CursorPage<MessageResponse> p2 = service.history(owner.getId(), room.getId(), p1.nextCursor(), 2);
			assertThat(p2.items()).extracting(MessageResponse::content).containsExactly("내 1", "내 0");
			assertThat(p2.nextCursor()).isNull();
		}

		@Test
		void AI_컨텍스트는_상대의_AI_대화는_넣고_HUMAN_대화는_뺀다() {
			joinGuest();
			messageMapper.insert(Message.user(room.getId(), guest.getId(), "상대의 AI 질문", Message.InputType.TEXT, RoomMode.AI));
			messageMapper.insert(Message.user(room.getId(), guest.getId(), "AI 몰래 한 말", Message.InputType.TEXT, RoomMode.HUMAN));
			messageMapper.insert(Message.user(room.getId(), owner.getId(), "나도 몰래", Message.InputType.TEXT, RoomMode.HUMAN));
			llm.reply("ok");

			service.send(owner.getId(), room.getId(), "내 질문", Message.InputType.TEXT);

			List<ChatMessage> ctx = llm.calls.get(0);
			assertThat(ctx).extracting(ChatMessage::content)
				.contains("[참여자 영희] 상대의 AI 질문", "[개설자 철수] 내 질문")
				.noneMatch(c -> c.contains("몰래"));
		}

		@Test
		void 시스템_프롬프트에_비공개_지시가_붙는다() {
			joinGuest();
			llm.reply("ok");

			service.send(owner.getId(), room.getId(), "안녕", Message.InputType.TEXT);

			assertThat(llm.calls.get(0).get(0).content()).contains(AiContextBuilder.PRIVACY_INSTRUCTION);
		}

		@Test
		void HUMAN_모드에서_잘라낸_행은_최근_N_창을_먹지_않는다() {
			joinGuest();
			for (int i = 0; i < 40; i++) {
				messageMapper.insert(Message.user(room.getId(), guest.getId(), "몰래 " + i, Message.InputType.TEXT, RoomMode.HUMAN));
			}
			messageMapper.insert(Message.user(room.getId(), owner.getId(), "오래된 AI 질문", Message.InputType.TEXT, RoomMode.AI));
			llm.reply("ok");

			service.send(owner.getId(), room.getId(), "새 질문", Message.InputType.TEXT);

			assertThat(llm.calls.get(0)).extracting(ChatMessage::content)
				.containsExactly(llm.calls.get(0).get(0).content(), "[개설자 철수] 오래된 AI 질문", "[개설자 철수] 새 질문");
		}
	}

	@Nested
	@DisplayName("history")
	class History {

		@Test
		void 최신부터_size_만큼_커서로_이어_받고_비멤버는_404() {
			setHuman();
			Long[] ids = new Long[5];
			for (int i = 0; i < 5; i++) {
				// HUMAN 모드 = 방 전원 공개 — 참여자 시점으로 페이징을 본다(D-037)
				Message m = Message.user(room.getId(), owner.getId(), "m" + i, Message.InputType.TEXT, RoomMode.HUMAN);
				messageMapper.insert(m);
				ids[i] = m.getId();
			}

			CursorPage<MessageResponse> p1 = service.history(guest.getId(), room.getId(), null, 2);
			assertThat(p1.items()).extracting(MessageResponse::id).containsExactly(ids[4], ids[3]);
			assertThat(p1.nextCursor()).isNotNull();
			assertThat(p1.items().get(0).createdAt()).isInstanceOf(Instant.class);

			CursorPage<MessageResponse> p2 = service.history(guest.getId(), room.getId(), p1.nextCursor(), 2);
			assertThat(p2.items()).extracting(MessageResponse::id).containsExactly(ids[2], ids[1]);

			CursorPage<MessageResponse> p3 = service.history(guest.getId(), room.getId(), p2.nextCursor(), 2);
			assertThat(p3.items()).extracting(MessageResponse::id).containsExactly(ids[0]);
			assertThat(p3.nextCursor()).isNull();

			User other = newUser("남");
			assertError(() -> service.history(other.getId(), room.getId(), null, 2), ErrorCode.ROOM_NOT_FOUND);
		}
	}
}
