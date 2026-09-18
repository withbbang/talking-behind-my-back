package com.example.chat.message;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

/** T-007 방 단위 in-memory 브로드캐스트 (D-018) + T-031 유저 타겟 발행 (D-037). 인스턴스 1대 전제. 스프링 없이 직접 생성. */
class RoomEventBusTest {

	private static final long ME = 7L;
	private static final long YOU = 8L;

	private final RoomEventBus bus = new RoomEventBus();

	@Test
	void 같은_방_구독자_전원에게_이벤트가_가고_다른_방은_받지_않는다() {
		EventRecorder a = new EventRecorder();
		EventRecorder b = new EventRecorder();
		EventRecorder other = new EventRecorder();
		bus.subscribe(1L, ME, a.emitter);
		bus.subscribe(1L, YOU, b.emitter);
		bus.subscribe(2L, ME, other.emitter);

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
		bus.subscribe(1L, ME, a.emitter);
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
		bus.subscribe(1L, ME, a.emitter);
		bus.subscribe(1L, YOU, b.emitter);

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
		bus.subscribe(1L, ME, broken.emitter);
		bus.subscribe(1L, YOU, ok.emitter);
		broken.breakConnection();

		bus.publish(1L, "delta", Map.of("text", "a"));
		bus.publish(1L, "delta", Map.of("text", "b"));

		assertThat(bus.subscriberCount(1L)).isEqualTo(1);
		assertThat(ok.names()).containsExactly("delta", "delta");
	}

	@Test
	void publishTo_는_그_유저의_모든_구독에만_가고_상대는_못_받는다() {
		EventRecorder myTab1 = new EventRecorder();
		EventRecorder myTab2 = new EventRecorder();
		EventRecorder yours = new EventRecorder();
		EventRecorder otherRoom = new EventRecorder();
		bus.subscribe(1L, ME, myTab1.emitter);
		bus.subscribe(1L, ME, myTab2.emitter);
		bus.subscribe(1L, YOU, yours.emitter);
		bus.subscribe(2L, ME, otherRoom.emitter);

		bus.publishTo(1L, ME, "delta", Map.of("replyTo", 5L, "text", "안녕"));

		assertThat(myTab1.names()).containsExactly("delta");
		assertThat(myTab1.last().data()).isEqualTo(Map.of("replyTo", 5L, "text", "안녕"));
		assertThat(myTab2.names()).containsExactly("delta");
		assertThat(yours.events).isEmpty();
		assertThat(otherRoom.events).isEmpty();
	}

	@Test
	void publishTo_는_구독_없는_유저여도_예외_없음() {
		EventRecorder yours = new EventRecorder();
		bus.subscribe(1L, YOU, yours.emitter);

		bus.publishTo(1L, ME, "done", Map.of("replyTo", 5L));

		assertThat(yours.events).isEmpty();
	}

	@Test
	void publishTo_전송_실패한_emitter_는_제거되고_같은_유저의_다른_탭은_계속_받는다() {
		EventRecorder broken = new EventRecorder();
		EventRecorder ok = new EventRecorder();
		bus.subscribe(1L, ME, broken.emitter);
		bus.subscribe(1L, ME, ok.emitter);
		broken.breakConnection();

		bus.publishTo(1L, ME, "delta", Map.of("text", "a"));
		bus.publishTo(1L, ME, "delta", Map.of("text", "b"));

		assertThat(bus.subscriberCount(1L)).isEqualTo(1);
		assertThat(ok.names()).containsExactly("delta", "delta");
	}

	@Test
	void 하트비트는_모든_구독자에게_주석을_보낸다() {
		EventRecorder a = new EventRecorder();
		EventRecorder b = new EventRecorder();
		bus.subscribe(1L, ME, a.emitter);
		bus.subscribe(2L, YOU, b.emitter);

		bus.heartbeat();

		assertThat(a.comments).containsExactly(":connected", ":ping");
		assertThat(b.comments).containsExactly(":connected", ":ping");
		assertThat(a.events).isEmpty();
	}
}
