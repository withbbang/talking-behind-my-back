package com.example.chat.speech;

import java.util.function.LongSupplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * TTS 폴백 상태 (D-043). 1차가 실패하면 쿨다운 동안 1차를 건너뛰고 폴백으로 바로 간다 —
 * 1차(Edge)가 막혀 있는 동안 문장마다 실패 왕복을 기다리지 않게. 지나면 다시 1차부터.
 */
@Component
public class TtsFallback {

	private final TtsFallbackProperties props;
	private final LongSupplier nowMillis;
	private volatile long skipPrimaryUntil;

	@Autowired
	public TtsFallback(TtsFallbackProperties props) {
		this(props, System::currentTimeMillis);
	}

	TtsFallback(TtsFallbackProperties props, LongSupplier nowMillis) {
		this.props = props;
		this.nowMillis = nowMillis;
	}

	public boolean enabled() {
		return props.enabled();
	}

	public boolean skipPrimary() {
		return enabled() && nowMillis.getAsLong() < skipPrimaryUntil;
	}

	public void primaryFailed() {
		if (enabled()) skipPrimaryUntil = nowMillis.getAsLong() + props.cooldownSeconds() * 1000L;
	}

	public TtsFallbackProperties props() {
		return props;
	}
}
