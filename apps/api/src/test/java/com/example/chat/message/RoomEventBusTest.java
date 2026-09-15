package com.example.chat.message;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

/** T-007 방 단위 in-memory 브로드캐스트 (D-018). 인스턴스 1대 전제. 스프링 없이 직접 생성. */
class RoomEventBusTest {

	private final RoomEventBus bus = new RoomEventBus();

	@Test
	void 같은_방_구독자_전원에게_이벤트가_가고_다른_방은_받지_않는다() {
		EventRecorder a = new EventRecorder();
		EventRecorder b = new EventRecorder();
		EventRecorder other = new EventRecorder();
		bus.subscribe(1L, a.emitter);
		bus.subscribe(1L, b.emitter);
		bus.subscribe(2L, other.emitter);

		bus.publish(1L, "mode", Map.of("mode", "HUMAN"));

		assertThat(a.names()).containsExactly("mode");
		assertThat(a.last().data()).isEqualTo(Map.of("mode", "HUMAN"));
		assertThat(b.names()).containsExactly("mode");
		assertThat(other.events).isEmpty();
		assertThat(bus.subscriberCount(1L)).isEqualTo(2);
	}

	@Test
	void 구독_직후_connected_주석으로_헤더를_바로_흘린다() {
		EventRecorder a = new EventRecorder();
		bus.subscribe(1L, a.emitter);
		assertThat(a.comments).containsExactly(":connected");
		assertThat(a.events).isEmpty();
	}

	@Test
	void 구독자_0명인_방에_publish_해도_예외_없음() {
		bus.publish(99L, "delta", Map.of("text", "x"));
		assertThat(bus.subscriberCount(99L)).isZero();
	}

	@Test
	void 완료_타임아웃_된_emitter_는_제거된다() {
		EventRecorder a = new EventRecorder();
		EventRecorder b = new EventRecorder();
		bus.subscribe(1L, a.emitter);
		bus.subscribe(1L, b.emitter);

		a.onCompletion.run();
		b.onTimeout.run();

		assertThat(bus.subscriberCount(1L)).isZero();
		bus.publish(1L, "mode", Map.of("mode", "AI"));
		assertThat(a.events).isEmpty();
		assertThat(b.events).isEmpty();
	}

	@Test
	void 전송_실패한_emitter_는_제거되고_나머지는_계속_받는다() {
		EventRecorder broken = new EventRecorder();
		EventRecorder ok = new EventRecorder();
		bus.subscribe(1L, broken.emitter);
		bus.subscribe(1L, ok.emitter);
		broken.breakConnection();

		bus.publish(1L, "delta", Map.of("text", "a"));
		bus.publish(1L, "delta", Map.of("text", "b"));

		assertThat(bus.subscriberCount(1L)).isEqualTo(1);
		assertThat(ok.names()).containsExactly("delta", "delta");
	}

	@Test
	void 하트비트는_모든_구독자에게_주석을_보낸다() {
		EventRecorder a = new EventRecorder();
		EventRecorder b = new EventRecorder();
		bus.subscribe(1L, a.emitter);
		bus.subscribe(2L, b.emitter);

		bus.heartbeat();

		assertThat(a.comments).containsExactly(":connected", ":ping");
		assertThat(b.comments).containsExactly(":connected", ":ping");
		assertThat(a.events).isEmpty();
	}
}
