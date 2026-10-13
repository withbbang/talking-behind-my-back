package com.example.chat.global.config;

import com.example.chat.llm.LlmProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * OpenAI 호환 LLM(Gemini 롤백, D-044) 호출용 WebClient. SSE 스트림 소비는 OpenAiCompatLlmClient 에서.
 * 응답 본문 상한을 두지 않는다(스트림). 타임아웃은 요청 단위로 OpenAiCompatLlmClient 가 건다.
 */
@Configuration
public class WebClientConfig {

	@Bean
	public WebClient llmWebClient(WebClient.Builder builder, LlmProperties props) {
		WebClient.Builder b = builder
			.baseUrl(props.baseUrl())
			.codecs(c -> c.defaultCodecs().maxInMemorySize(-1));
		if (props.hasApiKey()) {
			b.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + props.apiKey());
		}
		return b.build();
	}
}
