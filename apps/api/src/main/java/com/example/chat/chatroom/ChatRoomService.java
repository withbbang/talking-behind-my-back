package com.example.chat.chatroom;

import com.example.chat.global.AppProperties;
import com.example.chat.global.CursorCodec;
import com.example.chat.global.CursorPage;
import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import java.time.ZoneId;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 방 CRUD + 멤버십 (API.md#rooms, T-006). 입장/재발급은 T-016, 나가기 분기·mode·aiPersonality 는 T-017.
 * 멤버 검증은 항상 활성 멤버십(left_at IS NULL) 기준 — 비멤버·나간 멤버는 404 ROOM_NOT_FOUND 로 통일.
 */
@Service
public class ChatRoomService {

	/** 사용자당 활성 방 상한 — 개설 + 참여 합산 (SCHEMA.md #4) */
	public static final int MAX_ACTIVE_ROOMS = 50;
	private static final int INVITE_CODE_RETRIES = 5;

	private final ChatRoomMapper rooms;
	private final RoomMemberMapper members;
	private final String baseUrl;
	private final ZoneId zone;

	public ChatRoomService(ChatRoomMapper rooms, RoomMemberMapper members, AppProperties props) {
		this.rooms = rooms;
		this.members = members;
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

	/** invite_code UNIQUE 충돌(32^8 중 1)이면 새 코드로 재시도 */
	private ChatRoom insertWithFreshCode(Long ownerId, String title) {
		DuplicateKeyException last = null;
		for (int i = 0; i < INVITE_CODE_RETRIES; i++) {
			ChatRoom room = ChatRoom.create(ownerId, title, InviteCodes.generate());
			try {
				rooms.insert(room);
				return room;
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

	/** title 은 OWNER 만 (2026-09-15 결정, API.md#rooms). 참여자 403, 비멤버 404. */
	@Transactional
	public RoomResponse updateTitle(Long userId, Long roomId, String title) {
		RoomMember me = activeMember(roomId, userId);
		if (!me.isOwner()) throw new BusinessException(ErrorCode.FORBIDDEN);
		rooms.updateTitle(roomId, title.trim());
		return detail(rooms.findById(roomId).orElseThrow(), me.getRole());
	}

	/**
	 * 나가기. OWNER → 방 ORPHANED + left_at(참여자 멤버십은 남긴다). PARTICIPANT → left_at 만.
	 * 참여자 이탈 시 mode=AI 복귀, ORPHANED 방 확인 처리 분기는 T-017.
	 */
	@Transactional
	public void leave(Long userId, Long roomId) {
		RoomMember me = activeMember(roomId, userId);
		members.leave(roomId, userId);
		if (me.isOwner()) rooms.updateStatus(roomId, RoomStatus.ORPHANED);
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
