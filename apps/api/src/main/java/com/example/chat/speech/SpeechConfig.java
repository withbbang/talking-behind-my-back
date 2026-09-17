package com.example.chat.speech;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.function.client.WebClient;

/** OpenAI 직접 호출용 WebClient (D-026). TTS 응답(mp3, 1,000자 ≈ 1~2MB)을 메모리에 받으므로 상한을 넉넉히. */
@Configuration
public class SpeechConfig {

	static final int MAX_IN_MEMORY = 16 * 1024 * 1024;

	@Bean
	public WebClient openAiWebClient(WebClient.Builder builder, SpeechProperties props) {
		WebClient.Builder b = builder
			.baseUrl(props.openaiBaseUrl())
			.codecs(c -> c.defaultCodecs().maxInMemorySize(MAX_IN_MEMORY));
		if (props.hasOpenaiApiKey()) {
			b.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + props.openaiApiKey());
		}
		return b.build();
	}
}
