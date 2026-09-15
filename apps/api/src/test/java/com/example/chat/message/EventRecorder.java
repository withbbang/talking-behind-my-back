package com.example.chat.message;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter.DataWithMediaType;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter.SseEventBuilder;

/**
 * 테스트용 SSE 구독자. 실제 SseEmitter 는 서블릿 응답이 있어야 쓸 수 있어서 mock 을 RoomEventBus 에 꽂고,
 * send 된 SseEventBuilder 를 (event 이름, data 객체) 로 풀어 기록한다. 하트비트(주석)는 comments 에.
 */
public class EventRecorder {

	public record Recorded(String name, Object data) {}

	private static final Pattern EVENT = Pattern.compile("event:(\\w+)\\n");

	public final SseEmitter emitter = mock(SseEmitter.class);
	public final List<Recorded> events = new ArrayList<>();
	public final List<String> comments = new ArrayList<>();
	public Runnable onCompletion;
	public Runnable onTimeout;

	public EventRecorder() {
		try {
			doAnswer(inv -> { record(inv.getArgument(0)); return null; }).when(emitter).send(any(SseEventBuilder.class));
		} catch (IOException e) {
			throw new IllegalStateException(e);
		}
		doAnswer(inv -> { onCompletion = inv.getArgument(0); return null; }).when(emitter).onCompletion(any());
		doAnswer(inv -> { onTimeout = inv.getArgument(0); return null; }).when(emitter).onTimeout(any());
	}

	/** 이후 send 가 IOException — 끊긴 클라이언트 흉내 */
	public void breakConnection() {
		try {
			doThrow(new IOException("broken pipe")).when(emitter).send(any(SseEventBuilder.class));
		} catch (IOException e) {
			throw new IllegalStateException(e);
		}
	}

	public List<String> names() {
		return events.stream().map(Recorded::name).toList();
	}

	public Recorded last() {
		return events.get(events.size() - 1);
	}

	private void record(SseEventBuilder builder) {
		String name = null;
		Object data = null;
		StringBuilder text = new StringBuilder();
		for (DataWithMediaType d : builder.build()) {
			if (d.getData() instanceof String s) text.append(s);
			else data = d.getData();
		}
		Matcher m = EVENT.matcher(text);
		if (m.find()) name = m.group(1);
		if (name == null && text.toString().startsWith(":")) {
			comments.add(text.toString().trim());
			return;
		}
		events.add(new Recorded(name, data));
	}
}
