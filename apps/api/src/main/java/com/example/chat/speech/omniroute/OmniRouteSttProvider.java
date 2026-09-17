package com.example.chat.speech.omniroute;

import com.example.chat.speech.SpeechException;
import com.example.chat.speech.SpeechProperties;
import com.example.chat.speech.SttProvider;
import java.nio.file.Path;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * OmniRoute `POST /v1/audio/transcriptions` (OpenAI 호환, verbose_json → text + duration 초) (D-027). 호출 스레드를 블록한다.
 * OmniRoute 는 `model` 을 `provider/model` 로 해석해 공급자에 그대로 넘기고 응답도 그대로 돌려준다 — duration 이 없는 공급자면 0.
 * 파일 포맷은 확장자로 판별되므로 SpeechService 가 content-type 기준 확장자로 저장한다.
 */
@Component
@ConditionalOnProperty(name = "app.speech.stt-provider", havingValue = "omniroute", matchIfMissing = true)
public class OmniRouteSttProvider implements SttProvider {

	private final WebClient webClient;
	private final SpeechProperties props;
	private final ObjectMapper json = new ObjectMapper();

	public OmniRouteSttProvider(WebClient omniRouteWebClient, SpeechProperties props) {
		this.webClient = omniRouteWebClient;
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
			throw new SpeechException("omniroute stt responded " + e.getStatusCode().value(), e);
		} catch (RuntimeException e) {
			throw new SpeechException("omniroute stt call failed: " + SpeechException.rootName(e), e);
		}
		JsonNode node = parse(raw);
		JsonNode text = node.path("text");
		if (!text.isString()) throw new SpeechException("omniroute stt response has no text", null);
		JsonNode duration = node.path("duration");
		long durationMs = duration.isNumber() ? Math.round(duration.asDouble() * 1000) : 0;
		return new Transcript(text.asString(), durationMs);
	}

	@Override
	public String name() {
		return "omniroute";
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
			throw new SpeechException("omniroute stt response is not json", e);
		}
	}
}
