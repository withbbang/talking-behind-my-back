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
 * 이벤트 이름: message / delta / done / error / mode / member (API.md#messages).
 * emitter 타임아웃은 무제한(0L)이고 20초마다 `: ping` 주석으로 nginx `proxy_read_timeout`(300s) 을 넘긴다.
 * 끊긴 클라이언트는 send 실패·완료·타임아웃 콜백에서 제거된다.
 */
@Component
public class RoomEventBus {

	private static final Logger log = LoggerFactory.getLogger(RoomEventBus.class);
	static final long HEARTBEAT_MS = 20_000;

	private final Map<Long, List<SseEmitter>> rooms = new ConcurrentHashMap<>();

	public SseEmitter subscribe(Long roomId) {
		return subscribe(roomId, new SseEmitter(0L));
	}

	/** emitter 를 직접 넘기는 형태 — 테스트(mock emitter)용. */
	public SseEmitter subscribe(Long roomId, SseEmitter emitter) {
		rooms.computeIfAbsent(roomId, k -> new CopyOnWriteArrayList<>()).add(emitter);
		emitter.onCompletion(() -> remove(roomId, emitter));
		emitter.onTimeout(() -> remove(roomId, emitter));
		emitter.onError(e -> remove(roomId, emitter));
		return emitter;
	}

	public void publish(Long roomId, String event, Object data) {
		List<SseEmitter> subscribers = rooms.get(roomId);
		if (subscribers == null) return;
		for (SseEmitter emitter : subscribers) {
			try {
				emitter.send(SseEmitter.event().name(event).data(data));
			} catch (IOException | RuntimeException e) {
				log.debug("SSE send failed room={} event={} — dropping subscriber: {}", roomId, event, e.toString());
				remove(roomId, emitter);
			}
		}
	}

	@Scheduled(fixedRate = HEARTBEAT_MS)
	public void heartbeat() {
		rooms.forEach((roomId, subscribers) -> {
			for (SseEmitter emitter : subscribers) {
				try {
					emitter.send(SseEmitter.event().comment("ping"));
				} catch (IOException | RuntimeException e) {
					remove(roomId, emitter);
				}
			}
		});
	}

	int subscriberCount(Long roomId) {
		List<SseEmitter> subscribers = rooms.get(roomId);
		return subscribers == null ? 0 : subscribers.size();
	}

	private void remove(Long roomId, SseEmitter emitter) {
		rooms.computeIfPresent(roomId, (k, list) -> {
			list.remove(emitter);
			return list.isEmpty() ? null : list;
		});
	}
}
