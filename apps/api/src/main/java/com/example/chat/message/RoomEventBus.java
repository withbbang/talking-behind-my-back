package com.example.chat.message;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 방 단위 SSE 브로드캐스트 (D-018, D-019). in-memory, 인스턴스 1대 전제 — 수평 확장 시 Redis pub/sub 로 교체.
 * 구독은 `(roomId, userId)` — 한 유저가 여러 탭을 열면 그 유저의 구독이 여러 개다.
 * {@link #publish} = 방 전원(mode/member, HUMAN 모드 message), {@link #publishTo} = 그 유저의 모든 탭만
 * (AI 모드 message·delta·done·error — 상대는 그 대화를 못 본다, D-037).
 * 이벤트 이름: message / delta / done / error / mode / member (API.md#messages).
 * emitter 타임아웃은 무제한(0L)이고 20초마다 `: ping` 주석으로 nginx `proxy_read_timeout`(300s) 을 넘긴다.
 * 끊긴 클라이언트는 send 실패·완료·타임아웃 콜백에서 제거된다.
 */
@Component
public class RoomEventBus {

	private static final Logger log = LoggerFactory.getLogger(RoomEventBus.class);
	static final long HEARTBEAT_MS = 20_000;

	/** 한 구독 = (보는 사람, emitter). 같은 userId 가 여러 행일 수 있다(탭 여러 개). */
	private record Sub(Long userId, SseEmitter emitter) {}

	private final Map<Long, List<Sub>> rooms = new ConcurrentHashMap<>();

	public SseEmitter subscribe(Long roomId, Long userId) {
		return subscribe(roomId, userId, new SseEmitter(0L));
	}

	/** emitter 를 직접 넘기는 형태 — 테스트(mock emitter)용. */
	public SseEmitter subscribe(Long roomId, Long userId, SseEmitter emitter) {
		rooms.computeIfAbsent(roomId, k -> new CopyOnWriteArrayList<>()).add(new Sub(userId, emitter));
		emitter.onCompletion(() -> remove(roomId, emitter));
		emitter.onTimeout(() -> remove(roomId, emitter));
		emitter.onError(e -> remove(roomId, emitter));
		// 첫 바이트를 즉시 내보내 헤더가 바로 커밋되게 — 없으면 EventSource.onopen 이 첫 이벤트/하트비트까지 기다린다(QA 실서버).
		try {
			emitter.send(SseEmitter.event().comment("connected"));
		} catch (IOException | RuntimeException e) {
			remove(roomId, emitter);
		}
		return emitter;
	}

	/** 방 전원에게 — mode/member, HUMAN 모드 message. */
	public void publish(Long roomId, String event, Object data) {
		send(roomId, null, event, data);
	}

	/** userId 의 모든 구독에만 — AI 모드 message·delta·done·error (D-037). 구독이 없으면 조용히 버린다. */
	public void publishTo(Long roomId, Long userId, String event, Object data) {
		send(roomId, userId, event, data);
	}

	private void send(Long roomId, Long onlyUserId, String event, Object data) {
		List<Sub> subscribers = rooms.get(roomId);
		if (subscribers == null) return;
		for (Sub sub : subscribers) {
			if (onlyUserId != null && !onlyUserId.equals(sub.userId())) continue;
			try {
				sub.emitter().send(SseEmitter.event().name(event).data(data));
			} catch (IOException | RuntimeException e) {
				log.debug("SSE send failed room={} event={} — dropping subscriber: {}", roomId, event, e.toString());
				remove(roomId, sub.emitter());
			}
		}
	}

	@Scheduled(fixedRate = HEARTBEAT_MS)
	public void heartbeat() {
		rooms.forEach((roomId, subscribers) -> {
			for (Sub sub : subscribers) {
				try {
					sub.emitter().send(SseEmitter.event().comment("ping"));
				} catch (IOException | RuntimeException e) {
					remove(roomId, sub.emitter());
				}
			}
		});
	}

	int subscriberCount(Long roomId) {
		List<Sub> subscribers = rooms.get(roomId);
		return subscribers == null ? 0 : subscribers.size();
	}

	private void remove(Long roomId, SseEmitter emitter) {
		rooms.computeIfPresent(roomId, (k, list) -> {
			list.removeIf(sub -> sub.emitter() == emitter);
			return list.isEmpty() ? null : list;
		});
	}
}
