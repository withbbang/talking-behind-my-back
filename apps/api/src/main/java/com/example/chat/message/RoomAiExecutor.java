package com.example.chat.message;

import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 방당 직렬 큐 + 공용 스레드풀 (D-018). 방 하나의 잡은 순서대로, 서로 다른 방은 병렬.
 * 사용법: {@link #reserve} (409/503 판정) → DB 저장 → {@link Ticket#start} (또는 실패 시 {@link Ticket#cancel}).
 * 예약을 먼저 하는 이유: USER 메시지를 저장한 뒤에 409 를 내면 중복 저장이 남는다.
 * 같은 유저는 진행·대기 중인 잡이 하나라도 있으면 409 ROOM_BUSY. 방 큐는 유저당 1건이므로 2인 방에서 최대 2건.
 * 풀이 꽉 찬 상태에서 "새 방"의 드레이너를 띄워야 하면 503 AI_BUSY(이미 도는 방의 대기는 큐에만 쌓이므로 허용).
 */
public class RoomAiExecutor {

	private static final Logger log = LoggerFactory.getLogger(RoomAiExecutor.class);

	private final Executor pool;
	private final Map<Long, RoomQueue> rooms = new ConcurrentHashMap<>();

	public RoomAiExecutor(Executor pool) {
		this.pool = pool;
	}

	public Ticket reserve(Long roomId, Long userId) {
		RoomQueue q = rooms.computeIfAbsent(roomId, k -> new RoomQueue());
		synchronized (q) {
			if (q.pendingUsers.contains(userId)) throw new BusinessException(ErrorCode.ROOM_BUSY);
			if (!q.running && saturated()) throw new BusinessException(ErrorCode.AI_BUSY);
			q.pendingUsers.add(userId);
		}
		return new Ticket(roomId, userId);
	}

	boolean hasPending(Long roomId, Long userId) {
		RoomQueue q = rooms.get(roomId);
		if (q == null) return false;
		synchronized (q) {
			return q.pendingUsers.contains(userId);
		}
	}

	/** 근사치 — 드레이너 제출 시 RejectedExecutionException 이 최종 판정이다. */
	private boolean saturated() {
		if (pool instanceof ThreadPoolExecutor tpe) {
			return tpe.getActiveCount() >= tpe.getMaximumPoolSize() && tpe.getQueue().remainingCapacity() == 0;
		}
		return false;
	}

	private void drain(RoomQueue q) {
		while (true) {
			Job job;
			synchronized (q) {
				job = q.jobs.poll();
				if (job == null) {
					q.running = false;
					return;
				}
			}
			try {
				job.runnable.run();
			} catch (RuntimeException e) {
				log.error("AI job failed room={} user={}", job.roomId, job.userId, e);
			} finally {
				synchronized (q) {
					q.pendingUsers.remove(job.userId);
				}
			}
		}
	}

	public final class Ticket {

		private final Long roomId;
		private final Long userId;
		private boolean used;

		private Ticket(Long roomId, Long userId) {
			this.roomId = roomId;
			this.userId = userId;
		}

		/** 큐에 넣고, 이 방의 드레이너가 없으면 풀에 하나 띄운다. 풀 거부 시 예약을 되돌리고 503. */
		public void start(Runnable runnable) {
			RoomQueue q = rooms.get(roomId);
			synchronized (q) {
				if (used) throw new IllegalStateException("ticket already used");
				used = true;
				q.jobs.add(new Job(roomId, userId, runnable));
				if (q.running) return;
				q.running = true;
				try {
					pool.execute(() -> drain(q));
				} catch (RejectedExecutionException e) {
					q.jobs.removeIf(j -> j.userId.equals(userId));
					q.pendingUsers.remove(userId);
					q.running = false;
					throw new BusinessException(ErrorCode.AI_BUSY);
				}
			}
		}

		public void cancel() {
			RoomQueue q = rooms.get(roomId);
			synchronized (q) {
				if (used) return;
				used = true;
				q.pendingUsers.remove(userId);
			}
		}
	}

	private record Job(Long roomId, Long userId, Runnable runnable) {}

	private static final class RoomQueue {
		final Deque<Job> jobs = new ArrayDeque<>();
		final Set<Long> pendingUsers = new HashSet<>();
		boolean running;
	}
}
