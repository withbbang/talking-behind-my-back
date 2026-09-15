package com.example.chat.message;

import com.example.chat.chatroom.ChatRoom;
import com.example.chat.chatroom.ChatRoomMapper;
import com.example.chat.chatroom.RoomMember;
import com.example.chat.chatroom.RoomMemberMapper;
import com.example.chat.chatroom.RoomMode;
import com.example.chat.global.AppProperties;
import com.example.chat.global.CursorCodec;
import com.example.chat.global.CursorPage;
import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import com.example.chat.llm.LlmClient;
import com.example.chat.llm.LlmException;
import com.example.chat.llm.LlmProperties;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 메시지 전송·AI 잡·과거 조회 (API.md#messages, D-018, D-019).
 * 전송: 멤버 검증 → (AI 모드) 큐 예약(409/503) → [tx: USER 저장 + touch + 자동 제목 + usage] → `message` 브로드캐스트 → 잡 시작 → 202.
 * 잡: 방 재확인(HUMAN 이면 skip) → 컨텍스트 조립 → 스트림(`delta`) → [tx: ASSISTANT 저장 + touch + 토큰 usage] → `done`.
 * 스트리밍 중에는 트랜잭션을 열지 않는다(CONVENTIONS). 상류 실패는 `error` 이벤트, 부분 응답 폐기.
 */
@Service
public class MessageService {

	private static final Logger log = LoggerFactory.getLogger(MessageService.class);

	private final MessageMapper messages;
	private final ChatRoomMapper rooms;
	private final RoomMemberMapper members;
	private final DailyUsageMapper usage;
	private final RoomEventBus bus;
	private final RoomAiExecutor executor;
	private final LlmClient llm;
	private final LlmProperties llmProps;
	private final AppProperties appProps;
	private final TransactionTemplate tx;

	public MessageService(MessageMapper messages, ChatRoomMapper rooms, RoomMemberMapper members, DailyUsageMapper usage,
		RoomEventBus bus, RoomAiExecutor executor, LlmClient llm, LlmProperties llmProps, AppProperties appProps,
		TransactionTemplate tx) {
		this.messages = messages;
		this.rooms = rooms;
		this.members = members;
		this.usage = usage;
		this.bus = bus;
		this.executor = executor;
		this.llm = llm;
		this.llmProps = llmProps;
		this.appProps = appProps;
		this.tx = tx;
	}

	/** 과거 메시지, id DESC. 커서는 (createdAt|id) 불투명 문자열이나 판정은 id 만 쓴다. 비멤버 404. */
	public CursorPage<MessageResponse> history(Long userId, Long roomId, String cursor, Integer size) {
		requireActiveMember(roomId, userId);
		Long cursorId = cursor == null ? null : CursorCodec.decode(cursor).id();
		int pageSize = CursorCodec.clampSize(size);
		List<Message> rows = messages.findByRoomId(roomId, cursorId, pageSize + 1);
		return CursorPage.of(rows, pageSize, m -> MessageResponse.of(m, appProps.zoneId()),
			m -> CursorCodec.encode(m.getCreatedAt(), m.getId()));
	}

	/** @return 저장된 USER 메시지 id (202 본문) */
	public Long send(Long userId, Long roomId, String content, Message.InputType inputType) {
		requireActiveMember(roomId, userId);
		ChatRoom room = rooms.findById(roomId).orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));
		if (room.isOrphaned()) throw new BusinessException(ErrorCode.ROOM_ORPHANED);
		boolean ai = room.getMode() == RoomMode.AI;
		RoomAiExecutor.Ticket ticket = ai ? executor.reserve(roomId, userId) : null;

		Message saved;
		try {
			saved = tx.execute(status -> {
				Message m = Message.user(roomId, userId, content, inputType, room.getMode());
				messages.insert(m);
				rooms.touchOnNewMessage(roomId);
				if (room.getMessageCount() == 0 && ChatRoom.DEFAULT_TITLE.equals(room.getTitle())) {
					rooms.updateTitle(roomId, ChatRoom.autoTitle(content));
				}
				usage.addMessage(userId, today());
				return messages.findById(m.getId()).orElseThrow();
			});
		} catch (RuntimeException e) {
			if (ticket != null) ticket.cancel();
			throw e;
		}
		bus.publish(roomId, "message", MessageResponse.of(saved, appProps.zoneId()));
		if (ticket != null) {
			Long messageId = saved.getId();
			ticket.start(() -> runAiJob(roomId, messageId, userId));
		}
		return saved.getId();
	}

	/** 워커 스레드에서 실행. 예외는 여기서 전부 삼킨다(큐가 막히면 안 된다). */
	void runAiJob(Long roomId, Long userMessageId, Long senderUserId) {
		Optional<ChatRoom> found = rooms.findById(roomId);
		if (found.isEmpty() || found.get().getMode() != RoomMode.AI) {
			log.info("AI job skipped room={} reply_to={} (room gone or HUMAN)", roomId, userMessageId);
			return;
		}
		ChatRoom room = found.get();
		List<RoomMember> allMembers = members.findAllByRoomId(roomId);
		List<Message> recent = messages.findRecentByRoomId(roomId, llmProps.contextMaxMessages());
		List<LlmClient.ChatMessage> context = AiContextBuilder.build(room, allMembers, recent);

		LlmClient.Result result;
		try {
			result = llm.stream(context, text -> bus.publish(roomId, "delta", Map.of("replyTo", userMessageId, "text", text)));
		} catch (LlmException e) {
			log.warn("AI job failed room={} reply_to={}: {}", roomId, userMessageId, e.getMessage());
			publishError(roomId, userMessageId);
			return;
		}
		if (result.content() == null || result.content().isBlank()) {
			log.warn("AI job empty response room={} reply_to={}", roomId, userMessageId);
			publishError(roomId, userMessageId);
			return;
		}

		int promptTokens = result.promptTokens() == null ? 0 : result.promptTokens();
		int completionTokens = result.completionTokens() == null ? 0 : result.completionTokens();
		Message saved = tx.execute(status -> {
			Message m = Message.assistant(roomId, result.content(), result.model(), result.promptTokens(), result.completionTokens());
			messages.insert(m);
			rooms.touchOnNewMessage(roomId);
			usage.addTokens(senderUserId, today(), promptTokens, completionTokens);
			return messages.findById(m.getId()).orElseThrow();
		});
		bus.publish(roomId, "done", Map.of(
			"message", MessageResponse.of(saved, appProps.zoneId()),
			"replyTo", userMessageId,
			"promptTokens", promptTokens,
			"completionTokens", completionTokens));
	}

	private void publishError(Long roomId, Long userMessageId) {
		bus.publish(roomId, "error", Map.of(
			"replyTo", userMessageId,
			"code", ErrorCode.LLM_UPSTREAM_ERROR.name(),
			"message", ErrorCode.LLM_UPSTREAM_ERROR.getDefaultMessage()));
	}

	private void requireActiveMember(Long roomId, Long userId) {
		members.findActive(roomId, userId).orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));
	}

	private LocalDate today() {
		return LocalDate.now(appProps.zoneId());
	}
}
