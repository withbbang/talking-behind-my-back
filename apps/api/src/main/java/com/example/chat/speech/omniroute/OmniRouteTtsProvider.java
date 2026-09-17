package com.example.chat.speech.omniroute;

import com.example.chat.speech.SpeechException;
import com.example.chat.speech.SpeechProperties;
import com.example.chat.speech.TtsProvider;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/** OmniRoute `POST /v1/audio/speech` (OpenAI 호환, mp3) (D-027). `model` 은 `provider/model`. 호출 스레드를 블록한다. */
@Component
@ConditionalOnProperty(name = "app.speech.tts-provider", havingValue = "omniroute", matchIfMissing = true)
public class OmniRouteTtsProvider implements TtsProvider {

	private final WebClient webClient;
	private final SpeechProperties props;

	public OmniRouteTtsProvider(WebClient omniRouteWebClient, SpeechProperties props) {
		this.webClient = omniRouteWebClient;
		this.props = props;
	}

	@Override
	public byte[] synthesize(String text, String voice) {
		Map<String, Object> body = Map.of(
			"model", props.ttsModel(),
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
			throw new SpeechException("omniroute tts responded " + e.getStatusCode().value(), e);
		} catch (RuntimeException e) {
			throw new SpeechException("omniroute tts call failed: " + e.getClass().getSimpleName(), e);
		}
		if (out == null || out.length == 0) throw new SpeechException("omniroute tts returned empty body", null);
		return out;
	}

	@Override
	public String name() {
		return "omniroute";
	}
}
