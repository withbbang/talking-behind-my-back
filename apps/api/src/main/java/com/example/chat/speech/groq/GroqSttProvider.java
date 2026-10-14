package com.example.chat.speech.groq;

import com.example.chat.speech.SpeechException;
import com.example.chat.speech.SpeechProperties;
import com.example.chat.speech.SttProvider;
import java.nio.file.Path;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Groq `POST /openai/v1/audio/transcriptions` 직접 호출 (OpenAI 호환, verbose_json → text + duration 초) (D-044). 호출 스레드를 블록한다.
 * 언어는 Whisper 자동 감지(D-042). duration 이 없으면 0 — SpeechService 가 클라이언트 실측으로 대신한다.
 * 파일 포맷은 확장자로 판별되므로 SpeechService 가 content-type 기준 확장자로 저장한다.
 */
@Component
@ConditionalOnProperty(name = "app.speech.stt-provider", havingValue = "groq", matchIfMissing = true)
public class GroqSttProvider implements SttProvider {

	private final WebClient webClient;
	private final SpeechProperties props;
	private final ObjectMapper json = new ObjectMapper();

	public GroqSttProvider(WebClient.Builder builder, GroqSpeechProperties groq, SpeechProperties props) {
		WebClient.Builder b = builder.clone().baseUrl(groq.baseUrl());
		if (groq.hasApiKey()) b.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + groq.apiKey());
		this.webClient = b.build();
		this.props = props;
	}

	@Override
	public Transcript transcribe(Path audio, String contentType) {
		MultipartBodyBuilder body = new MultipartBodyBuilder();
		body.part("file", new FileSystemResource(audio)).contentType(mediaType(contentType));
		body.part("model", props.sttModel());
		body.part("response_format", "verbose_json");
		String raw;
		try {
			raw = webClient.post().uri("/audio/transcriptions")
				.contentType(MediaType.MULTIPART_FORM_DATA)
				.body(BodyInserters.fromMultipartData(body.build()))
				.retrieve()
				.bodyToMono(String.class)
				.timeout(props.timeout())
				.block();
		} catch (WebClientResponseException e) {
			throw new SpeechException("groq stt responded " + e.getStatusCode().value(), e);
		} catch (RuntimeException e) {
			throw new SpeechException("groq stt call failed: " + SpeechException.rootName(e), e);
		}
		JsonNode node = parse(raw);
		JsonNode text = node.path("text");
		if (!text.isString()) throw new SpeechException("groq stt response has no text", null);
		JsonNode duration = node.path("duration");
		long durationMs = duration.isNumber() ? Math.round(duration.asDouble() * 1000) : 0;
		return new Transcript(speechOnly(text.asString(), node.path("segments")), durationMs);
	}

	/** 무음 판정 기준 (D-045, 2026-10-14 실측: 무음 " you" nsp 0.70·lp -0.71, 큰 잡음 "Kjell Kronström" lp -1.35, 실제 발화 nsp≈0·lp > -0.2). */
	static final double NO_SPEECH_PROB_MAX = 0.6;
	static final double AVG_LOGPROB_MIN = -1.0;

	/**
	 * Whisper 는 무음·잡음에도 "you"/"Thank you."/"." 같은 텍스트를 지어낸다(모바일 QA B-3).
	 * 무음 확률이 높거나 확신이 낮은 세그먼트를 버리고, 남은 게 글자·숫자 없는 구두점뿐이면 빈 텍스트 →
	 * 프론트의 "아무 말도 안 들렸는데?" 분기. segments 가 없으면 판단 근거가 없으니 text 그대로.
	 */
	static String speechOnly(String text, JsonNode segments) {
		if (!segments.isArray() || segments.isEmpty()) return text;
		StringBuilder kept = new StringBuilder();
		for (JsonNode seg : segments) {
			if (seg.path("no_speech_prob").asDouble(0) > NO_SPEECH_PROB_MAX) continue;
			if (seg.path("avg_logprob").asDouble(0) < AVG_LOGPROB_MIN) continue;
			kept.append(seg.path("text").asString(""));
		}
		String result = kept.toString();
		return result.codePoints().anyMatch(Character::isLetterOrDigit) ? result : "";
	}

	@Override
	public String name() {
		return "groq";
	}

	private static MediaType mediaType(String contentType) {
		try {
			return contentType == null || contentType.isBlank() ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(contentType);
		} catch (RuntimeException e) {
			return MediaType.APPLICATION_OCTET_STREAM;
		}
	}

	private JsonNode parse(String raw) {
		try {
			return json.readTree(raw == null ? "" : raw);
		} catch (RuntimeException e) {
			throw new SpeechException("groq stt response is not json", e);
		}
	}
}
