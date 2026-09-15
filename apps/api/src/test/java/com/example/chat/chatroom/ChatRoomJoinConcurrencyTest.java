package com.example.chat.chatroom;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import com.example.chat.user.User;
import com.example.chat.user.UserMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * T-016 동시 입장 — 정원 2명 잠금(SELECT ... FOR UPDATE, SCHEMA.md #4-1).
 * 스레드 2개가 각자 커넥션·트랜잭션을 쓰므로 @Transactional 롤백을 못 쓴다. 실제 커밋 후 @AfterEach 에서 직접 지운다.
 */
@SpringBootTest
class ChatRoomJoinConcurrencyTest {

	@Autowired ChatRoomService service;
	@Autowired RoomMemberMapper memberMapper;
	@Autowired UserMapper userMapper;
	@Autowired JdbcTemplate jdbc;

	private final List<Long> userIds = new ArrayList<>();
	private Long roomId;

	@BeforeEach
	void users() {
		for (String n : List.of("주인", "손님A", "손님B")) {
			User u = User.builder().nickname(n).build();
			userMapper.insert(u);
			userIds.add(u.getId());
		}
	}

	@AfterEach
	void cleanup() {
		if (roomId != null) {
			jdbc.update("DELETE FROM room_members WHERE room_id = ?", roomId);
			jdbc.update("DELETE FROM chat_rooms WHERE id = ?", roomId);
		}
		for (Long id : userIds) jdbc.update("DELETE FROM users WHERE id = ?", id);
	}

	@Test
	void 동시_입장_2명_중_1명만_성공_나머지는_ROOM_FULL() throws Exception {
		RoomResponse room = service.create(userIds.get(0), null);
		roomId = room.id();
		String code = room.inviteCode();

		CountDownLatch start = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<ErrorCode>> results = new ArrayList<>();
		for (Long joiner : userIds.subList(1, 3)) {
			results.add(pool.submit(() -> {
				start.await();
				try {
					service.join(joiner, code);
					return null;
				} catch (BusinessException e) {
					return e.getErrorCode();
				}
			}));
		}
		start.countDown();
		pool.shutdown();
		assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();

		List<ErrorCode> outcomes = new ArrayList<>();
		for (Future<ErrorCode> f : results) outcomes.add(f.get());
		assertThat(outcomes).containsExactlyInAnyOrder(null, ErrorCode.ROOM_FULL);
		assertThat(memberMapper.findActiveByRoomId(roomId)).hasSize(2);
	}
}
