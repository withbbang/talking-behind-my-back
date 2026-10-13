package com.example.chat.speech;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

/** T-039 1차 실패 후 쿨다운 동안 1차를 건너뛴다 (D-043 (3)). */
class TtsFallbackTest {

	private final AtomicLong now = new AtomicLong(1_000_000);

	private TtsFallback fallback(String model) {
		return new TtsFallback(new TtsFallbackProperties(model, "ko", Map.of("en", "en"), 600), now::get);
	}

	@Test
	void 실패_전에는_1차를_건너뛰지_않는다() {
		assertThat(fallback("gtts/ko").skipPrimary()).isFalse();
	}

	@Test
	void 실패하면_쿨다운_동안_건너뛰고_지나면_다시_1차() {
		TtsFallback f = fallback("gtts/ko");
		f.primaryFailed();

		now.addAndGet(599_999);
		assertThat(f.skipPrimary()).isTrue();

		now.addAndGet(1);
		assertThat(f.skipPrimary()).isFalse();
	}

	@Test
	void 폴백_모델이_비면_꺼져_있고_건너뛰지도_않는다() {
		TtsFallback f = fallback("");
		f.primaryFailed();

		assertThat(f.enabled()).isFalse();
		assertThat(f.skipPrimary()).isFalse();
	}

	@Test
	void 폴백_모델이_있는데_기본_voice_가_비면_기동_실패() {
		assertThatThrownBy(() -> new TtsFallbackProperties("gtts/ko", " ", Map.of(), 600))
			.isInstanceOf(IllegalArgumentException.class);
	}
}
