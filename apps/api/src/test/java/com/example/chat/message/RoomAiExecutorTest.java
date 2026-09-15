package com.example.chat.message;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** T-007 방당 직렬 큐 + 공용 풀 (D-018). 실제 스레드로 순차/병렬/포화를 확인한다. */
class RoomAiExecutorTest {

	private ThreadPoolExecutor pool;

	private RoomAiExecutor executor(int core, int max, int queue) {
		pool = new ThreadPoolExecutor(core, max, 10, TimeUnit.SECONDS, new ArrayBlockingQueue<>(Math.max(queue, 1)));
		if (queue == 0) pool = new ThreadPoolExecutor(core, max, 10, TimeUnit.SECONDS, new java.util.concurrent.SynchronousQueue<>());
		return new RoomAiExecutor(pool);
	}

	@AfterEach
	void shutdown() {
		if (pool != null) pool.shutdownNow();
	}

	private static void assertError(ThrowingCallable call, ErrorCode code) {
		assertThatThrownBy(call).isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(code);
	}

	@Test
	void 같은_방_잡은_순차_다른_방_잡은_병렬() throws Exception {
		RoomAiExecutor ex = executor(4, 4, 16);
		List<String> log = new CopyOnWriteArrayList<>();
		CountDownLatch job1Started = new CountDownLatch(1);
		CountDownLatch release1 = new CountDownLatch(1);
		CountDownLatch otherRoomDone = new CountDownLatch(1);
		CountDownLatch allDone = new CountDownLatch(3);

		ex.reserve(1L, 10L).start(() -> {
			log.add("A1-start"); job1Started.countDown();
			await(release1); log.add("A1-end"); allDone.countDown();
		});
		assertThat(job1Started.await(2, TimeUnit.SECONDS)).isTrue();
		ex.reserve(1L, 11L).start(() -> { log.add("A2"); allDone.countDown(); });
		ex.reserve(2L, 10L).start(() -> { log.add("B1"); otherRoomDone.countDown(); allDone.countDown(); });

		// 방 2 는 방 1 이 막혀 있어도 실행된다
		assertThat(otherRoomDone.await(2, TimeUnit.SECONDS)).isTrue();
		assertThat(log).contains("B1").doesNotContain("A2");

		release1.countDown();
		assertThat(allDone.await(2, TimeUnit.SECONDS)).isTrue();
		assertThat(log.indexOf("A1-end")).isLessThan(log.indexOf("A2"));
	}

	@Test
	void 같은_유저의_잡이_진행_또는_대기_중이면_ROOM_BUSY_다른_유저는_가능() throws Exception {
		RoomAiExecutor ex = executor(2, 2, 4);
		CountDownLatch started = new CountDownLatch(1);
		CountDownLatch release = new CountDownLatch(1);
		ex.reserve(1L, 10L).start(() -> { started.countDown(); await(release); });
		assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();

		assertError(() -> ex.reserve(1L, 10L), ErrorCode.ROOM_BUSY);
		RoomAiExecutor.Ticket guest = ex.reserve(1L, 11L);          // 대기 등록만
		assertError(() -> ex.reserve(1L, 11L), ErrorCode.ROOM_BUSY);
		assertThat(ex.hasPending(1L, 11L)).isTrue();

		guest.cancel();
		assertThat(ex.hasPending(1L, 11L)).isFalse();
		release.countDown();
	}

	@Test
	void 잡이_끝나면_같은_유저가_다시_보낼_수_있고_예외_잡도_큐를_막지_않는다() throws Exception {
		RoomAiExecutor ex = executor(2, 2, 4);
		CountDownLatch first = new CountDownLatch(1);
		ex.reserve(1L, 10L).start(() -> { first.countDown(); throw new IllegalStateException("boom"); });
		assertThat(first.await(2, TimeUnit.SECONDS)).isTrue();
		waitUntil(() -> !ex.hasPending(1L, 10L));

		CountDownLatch second = new CountDownLatch(1);
		ex.reserve(1L, 10L).start(second::countDown);
		assertThat(second.await(2, TimeUnit.SECONDS)).isTrue();
	}

	@Test
	void 풀_포화_시_새_방_예약은_AI_BUSY_이미_도는_방의_대기는_허용() throws Exception {
		RoomAiExecutor ex = executor(1, 1, 0);
		CountDownLatch started = new CountDownLatch(1);
		CountDownLatch release = new CountDownLatch(1);
		ex.reserve(1L, 10L).start(() -> { started.countDown(); await(release); });
		assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();

		assertError(() -> ex.reserve(2L, 20L), ErrorCode.AI_BUSY);
		RoomAiExecutor.Ticket sameRoom = ex.reserve(1L, 11L);
		assertThat(sameRoom).isNotNull();
		sameRoom.cancel();
		release.countDown();
	}

	@Test
	void start_시점_거부는_예약을_되돌리고_AI_BUSY() throws Exception {
		RoomAiExecutor ex = executor(1, 1, 0);
		RoomAiExecutor.Ticket t = ex.reserve(2L, 20L);
		CountDownLatch started = new CountDownLatch(1);
		CountDownLatch release = new CountDownLatch(1);
		ex.reserve(1L, 10L).start(() -> { started.countDown(); await(release); });   // 예약 사이에 풀이 찼다
		assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();

		assertError(() -> t.start(() -> {}), ErrorCode.AI_BUSY);
		assertThat(ex.hasPending(2L, 20L)).isFalse();
		release.countDown();
	}

	private static void await(CountDownLatch latch) {
		try {
			latch.await(5, TimeUnit.SECONDS);
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
		}
	}

	private static void waitUntil(java.util.function.BooleanSupplier cond) throws InterruptedException {
		long deadline = System.currentTimeMillis() + 2000;
		while (!cond.getAsBoolean() && System.currentTimeMillis() < deadline) Thread.sleep(10);
		assertThat(cond.getAsBoolean()).isTrue();
	}
}
