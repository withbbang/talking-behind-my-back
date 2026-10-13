package com.example.chat.speech.azure;

import com.example.chat.speech.SpeechException;
import com.example.chat.speech.SpeechProperties;
import com.example.chat.speech.TtsProvider;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * Azure AI Speech TTS REST `POST /cognitiveservices/v1` (SSML → mp3) (D-044). 호출 스레드를 블록한다.
 * voice 는 Azure Neural 이름(`ko-KR-SunHiNeural`), `xml:lang` 은 그 접두(`ko-KR`)를 쓴다.
 */
@Component
@ConditionalOnProperty(name = "app.speech.tts-provider", havingValue = "azure")
public class AzureTtsProvider implements TtsProvider {

	private static final Pattern LOCALE = Pattern.compile("^([a-z]{2,3}-[A-Z]{2})-");
	private static final MediaType SSML = MediaType.parseMediaType("application/ssml+xml");

	private final WebClient webClient;
	private final AzureSpeechProperties azure;
	private final SpeechProperties props;

	public AzureTtsProvider(WebClient.Builder builder, AzureSpeechProperties azure, SpeechProperties props) {
		this.webClient = builder.clone().baseUrl(azure.baseUrl()).build();
		this.azure = azure;
		this.props = props;
	}

	@Override
	public byte[] synthesize(String text, String voice) {
		byte[] out;
		try {
			out = webClient.post().uri("/cognitiveservices/v1")
				.header("Ocp-Apim-Subscription-Key", azure.key() == null ? "" : azure.key())
				.header("X-Microsoft-OutputFormat", azure.outputFormat())
				.header("User-Agent", "chat-app")
				.contentType(SSML)
				.bodyValue(ssml(text, voice))
				.retrieve()
				.bodyToMono(byte[].class)
				.timeout(props.timeout())
				.block();
		} catch (WebClientResponseException e) {
			throw new SpeechException("azure tts responded " + e.getStatusCode().value(), e);
		} catch (RuntimeException e) {
			throw new SpeechException("azure tts call failed: " + SpeechException.rootName(e), e);
		}
		if (out == null || out.length == 0) throw new SpeechException("azure tts returned empty body", null);
		return out;
	}

	static String ssml(String text, String voice) {
		Matcher m = LOCALE.matcher(voice);
		String lang = m.find() ? m.group(1) : "ko-KR";
		return "<speak version='1.0' xml:lang='" + lang + "'><voice name='" + escape(voice) + "'>"
			+ escape(text) + "</voice></speak>";
	}

	private static String escape(String s) {
		return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
			.replace("\"", "&quot;").replace("'", "&apos;");
	}

	@Override
	public String name() {
		return "azure";
	}
}
