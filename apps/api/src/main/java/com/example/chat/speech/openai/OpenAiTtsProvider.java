package com.example.chat.speech.openai;

import com.example.chat.speech.SpeechException;
import com.example.chat.speech.SpeechProperties;
import com.example.chat.speech.TtsProvider;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/** OpenAI `POST /audio/speech` (mp3). 호출 스레드를 블록한다. */
@Component
@ConditionalOnProperty(name = "app.speech.tts-provider", havingValue = "openai", matchIfMissing = true)
public class OpenAiTtsProvider implements TtsProvider {

	private final WebClient webClient;
	private final SpeechProperties props;

	public OpenAiTtsProvider(WebClient openAiWebClient, SpeechProperties props) {
		this.webClient = openAiWebClient;
		this.props = props;
	}

	@Override
	public byte[] synthesize(String text, String voice) {
		Map<String, Object> body = Map.of(
			"model", props.openaiTtsModel(),
			"input", text,
			"voice", voice,
			"response_format", "mp3");
		byte[] out;
		try {
			out = webClient.post().uri("/audio/speech")
				.contentType(MediaType.APPLICATION_JSON)
				.bodyValue(body)
				.retrieve()
				.bodyToMono(byte[].class)
				.timeout(props.timeout())
				.block();
		} catch (WebClientResponseException e) {
			throw new SpeechException("openai tts responded " + e.getStatusCode().value(), e);
		} catch (RuntimeException e) {
			throw new SpeechException("openai tts call failed: " + e.getClass().getSimpleName(), e);
		}
		if (out == null || out.length == 0) throw new SpeechException("openai tts returned empty body", null);
		return out;
	}

	@Override
	public String name() {
		return "openai";
	}
}
