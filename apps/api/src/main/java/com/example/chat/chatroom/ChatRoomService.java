package com.example.chat.chatroom;

import com.example.chat.global.AppProperties;
import com.example.chat.global.CursorCodec;
import com.example.chat.global.CursorPage;
import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import com.example.chat.message.RoomEventBus;
import com.example.chat.user.UserMapper;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 방 CRUD + 멤버십 (API.md#rooms, T-006) + 초대 입장/재발급 (T-016) + 나가기 분기·mode·aiPersonality (T-017).
 * 멤버 검증은 항상 활성 멤버십(left_at IS NULL) 기준 — 비멤버·나간 멤버는 404 ROOM_NOT_FOUND 로 통일.
 */
@Service
public class ChatRoomService {

	/** 사용자당 활성 방 상한 — 개설 + 참여 합산 (SCHEMA.md #4) */
	public static final int MAX_ACTIVE_ROOMS = 50;
	/** 방 정원 — 개설자 + 참여자 1명 (SCHEMA.md #4-1) */
	public static final int MAX_MEMBERS = 2;
	private static final int INVITE_CODE_RETRIES = 5;

	private final ChatRoomMapper rooms;
	private final RoomMemberMapper members;
	private final UserMapper users;
	private final RoomEventBus bus;
	private final String baseUrl;
	private final ZoneId zone;

	public ChatRoomService(ChatRoomMapper rooms, RoomMemberMapper members, UserMapper users, RoomEventBus bus, AppProperties props) {
		this.rooms = rooms;
		this.members = members;
		this.users = users;
		this.bus = bus;
		this.baseUrl = props.baseUrl();
		this.zone = props.zoneId();
	}

	@Transactional
	public RoomResponse create(Long userId, String title) {
		if (members.countActiveByUserId(userId) >= MAX_ACTIVE_ROOMS) {
			throw new BusinessException(ErrorCode.ROOM_LIMIT_EXCEEDED);
		}
		ChatRoom room = insertWithFreshCode(userId, title);
		members.insert(RoomMember.owner(room.getId(), userId));
		return detail(rooms.findById(room.getId()).orElseThrow(), RoomMember.Role.OWNER);
	}

	private ChatRoom insertWithFreshCode(Long ownerId, String title) {
		return withFreshCode(code -> {
			ChatRoom room = ChatRoom.create(ownerId, title, code);
			rooms.insert(room);
			return room;
		});
	}

	/** invite_code UNIQUE 충돌(32^8 중 1)이면 새 코드로 재시도. 생성·재발급 공용. */
	private <T> T withFreshCode(Function<String, T> write) {
		DuplicateKeyException last = null;
		for (int i = 0; i < INVITE_CODE_RETRIES; i++) {
			try {
				return write.apply(InviteCodes.generate());
			} catch (DuplicateKeyException e) {
				last = e;
			}
		}
		BusinessException failed = new BusinessException(ErrorCode.INTERNAL_ERROR, "초대 코드 발급에 실패했습니다.");
		failed.initCause(last);
		throw failed;
	}

	@Transactional(readOnly = true)
	public CursorPage<RoomResponse> list(Long userId, String cursor, Integer size) {
		int pageSize = CursorCodec.clampSize(size);
		CursorCodec.Cursor c = cursor == null || cursor.isBlank() ? null : CursorCodec.decode(cursor);
		List<ChatRoom> rows = rooms.findListByMember(userId,
			c == null ? null : c.at(), c == null ? null : c.id(), pageSize + 1);
		return CursorPage.of(rows, pageSize,
			room -> RoomResponse.of(room, roleOf(room, userId), null, baseUrl, zone),
			room -> CursorCodec.encode(room.getLastMessageAt(), room.getId()));
	}

	@Transactional(readOnly = true)
	public RoomResponse get(Long userId, Long roomId) {
		RoomMember me = activeMember(roomId, userId);
		return detail(rooms.findById(roomId).orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND)), me.getRole());
	}

	/**
	 * PATCH 부분 갱신 (T-017). 판정 순서 404 멤버 → 400 검증 → 410 ORPHANED → 403 권한(title/aiPersonality 는 OWNER 만)
	 * → 400 MODE_NOT_ALLOWED(혼자인데 HUMAN). 한 요청은 전부-아니면-전무. 방 행을 FOR UPDATE 로 잠근 뒤 멤버 수를 세므로
	 * 참여자 leave 와 동시에 와도 혼자인 방이 HUMAN 으로 남지 않는다.
	 */
	@Transactional
	public RoomResponse update(Long userId, Long roomId, RoomUpdate update) {
		RoomMember me = activeMember(roomId, userId);
		validate(update);
		ChatRoom room = rooms.findByIdForUpdate(roomId).orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));
		if (room.isOrphaned()) throw new BusinessException(ErrorCode.ROOM_ORPHANED);
		if (update.needsOwner() && !me.isOwner()) throw new BusinessException(ErrorCode.FORBIDDEN);
		if (update.mode() == RoomMode.HUMAN && members.countActiveByRoomId(roomId) < MAX_MEMBERS) {
			throw new BusinessException(ErrorCode.MODE_NOT_ALLOWED);
		}
		if (update.title() != null) rooms.updateTitle(roomId, update.title().trim());
		if (update.mode() != null) {
			rooms.updateMode(roomId, update.mode());
			bus.publish(roomId, "mode", Map.of("mode", update.mode().name()));
		}
		if (update.aiPersonality() != null) {
			rooms.updateAiPersonality(roomId, update.aiPersonality());
			rooms.updateAiPrompt(roomId, null);   // 프리셋 재선택 = 커스텀 프롬프트 초기화 (D-017)
		}
		if (update.aiPrompt() != null) rooms.updateAiPrompt(roomId, update.normalizedAiPrompt());
		return detail(rooms.findById(roomId).orElseThrow(), me.getRole());
	}

	/** 빈 body 400. title 은 있으면 공백 불가(길이 상한은 컨트롤러 @Size). */
	private static void validate(RoomUpdate update) {
		if (update.isEmpty()) {
			throw new BusinessException(ErrorCode.VALIDATION_FAILED, "변경할 필드가 없습니다.");
		}
		if (update.title() != null && update.title().isBlank()) {
			throw new BusinessException(ErrorCode.VALIDATION_FAILED, ErrorCode.VALIDATION_FAILED.getDefaultMessage(),
				Map.of("title", "must not be blank"));
		}
	}

	/**
	 * 나가기. OWNER → 방 ORPHANED + left_at(참여자 멤버십은 남긴다). PARTICIPANT → left_at + 방이 ACTIVE 면 mode=AI 복귀(개설자 혼자).
	 * ORPHANED 방에서 참여자 나가기 = 확인 처리(멤버십만 종료, 방 행·mode 그대로). 방 행 잠금은 update 와 같은 이유(T-017).
	 */
	@Transactional
	public void leave(Long userId, Long roomId) {
		RoomMember me = activeMember(roomId, userId);
		ChatRoom room = rooms.findByIdForUpdate(roomId).orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));
		members.leave(roomId, userId);
		if (me.isOwner()) {
			rooms.updateStatus(roomId, RoomStatus.ORPHANED);
			publishMember(roomId, "LEFT", userId, RoomMember.Role.OWNER, RoomStatus.ORPHANED);
		} else {
			publishMember(roomId, "LEFT", userId, RoomMember.Role.PARTICIPANT, room.getStatus());
			if (!room.isOrphaned() && room.getMode() != RoomMode.AI) {
				rooms.updateMode(roomId, RoomMode.AI);
				bus.publish(roomId, "mode", Map.of("mode", RoomMode.AI.name()));
			}
		}
	}

	/** 개설자만. 참여자 403, 비멤버 404. 구 코드는 즉시 무효(UNIQUE 컬럼 교체). */
	@Transactional
	public InviteResponse regenerateInvite(Long userId, Long roomId) {
		RoomMember me = activeMember(roomId, userId);
		if (!me.isOwner()) throw new BusinessException(ErrorCode.FORBIDDEN);
		String code = withFreshCode(c -> {
			rooms.updateInviteCode(roomId, c);
			return c;
		});
		return InviteResponse.of(code, baseUrl);
	}

	/** 입장 미리보기. 입장과 같은 검증(404/410/400/409)을 잠금 없이 수행 — 프론트가 버튼 전에 안내할 수 있게. 이미 멤버면 그대로 200. */
	@Transactional(readOnly = true)
	public JoinPreviewResponse preview(Long userId, String code) {
		ChatRoom room = rooms.findByInviteCode(code).orElseThrow(() -> new BusinessException(ErrorCode.INVITE_NOT_FOUND));
		List<RoomMember> active = members.findActiveByRoomId(room.getId());
		checkJoinable(room, userId, active.size(), active.stream().anyMatch(m -> m.getUserId().equals(userId)));
		String ownerNickname = active.stream().filter(RoomMember::isOwner).map(RoomMember::getNickname).findFirst().orElse(null);
		return new JoinPreviewResponse(room.getId(), room.getTitle(), ownerNickname, active.size());
	}

	/**
	 * 입장. 방 행을 FOR UPDATE 로 잠근 뒤 정원을 세므로 동시 입장은 한 명만 통과한다(SCHEMA.md #4-1).
	 * 재입장은 left_at = NULL, joined_at = now. 이미 활성 멤버면 그대로 Room.
	 */
	@Transactional
	public RoomResponse join(Long userId, String code) {
		ChatRoom room = rooms.findByInviteCodeForUpdate(code).orElseThrow(() -> new BusinessException(ErrorCode.INVITE_NOT_FOUND));
		boolean alreadyMember = members.findActive(room.getId(), userId).isPresent();
		if (!checkJoinable(room, userId, members.countActiveByRoomId(room.getId()), alreadyMember)) {
			if (members.countActiveByUserId(userId) >= MAX_ACTIVE_ROOMS) {
				throw new BusinessException(ErrorCode.ROOM_LIMIT_EXCEEDED);
			}
			if (members.rejoin(room.getId(), userId) == 0) {
				members.insert(RoomMember.participant(room.getId(), userId));
			}
			publishMember(room.getId(), "JOINED", userId, RoomMember.Role.PARTICIPANT, room.getStatus());
		}
		return detail(rooms.findById(room.getId()).orElseThrow(), RoomMember.Role.PARTICIPANT);
	}

	/**
	 * 입장 가능 판정 순서(2026-09-15 결정): 410 ORPHANED → 400 SELF → 이미 멤버(true 반환, 통과) → 409 FULL.
	 * 활성 방 상한(409 LIMIT)은 실제 입장 직전에만 본다. @return 이미 활성 멤버인지
	 */
	private static boolean checkJoinable(ChatRoom room, Long userId, int activeCount, boolean alreadyMember) {
		if (room.isOrphaned()) throw new BusinessException(ErrorCode.ROOM_ORPHANED);
		if (room.getOwnerId().equals(userId)) throw new BusinessException(ErrorCode.SELF_INVITE);
		if (alreadyMember) return true;
		if (activeCount >= MAX_MEMBERS) throw new BusinessException(ErrorCode.ROOM_FULL);
		return false;
	}

	/**
	 * `member` 이벤트 (T-007, D-019). 트랜잭션 안에서 바로 발행한다 — 커밋 직전 수 ms 차이는 알림 용도로 무해하고,
	 * afterCommit 훅은 테스트 트랜잭션(롤백)에서 절대 돌지 않아 검증이 불가능하다.
	 */
	private void publishMember(Long roomId, String action, Long userId, RoomMember.Role role, RoomStatus status) {
		String nickname = users.findById(userId).map(u -> u.getNickname()).orElse("");
		bus.publish(roomId, "member", Map.of(
			"action", action, "userId", userId, "nickname", nickname, "role", role.name(), "roomStatus", status.name()));
	}

	private RoomMember activeMember(Long roomId, Long userId) {
		return members.findActive(roomId, userId).orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));
	}

	/** 목록 조회에서 멤버십 행 없이 역할을 알기 위해 — 개설자 id 비교 */
	private static RoomMember.Role roleOf(ChatRoom room, Long userId) {
		return room.getOwnerId().equals(userId) ? RoomMember.Role.OWNER : RoomMember.Role.PARTICIPANT;
	}

	private RoomResponse detail(ChatRoom room, RoomMember.Role myRole) {
		return RoomResponse.of(room, myRole, members.findActiveByRoomId(room.getId()), baseUrl, zone);
	}
}
