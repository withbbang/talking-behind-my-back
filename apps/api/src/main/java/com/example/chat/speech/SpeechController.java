package com.example.chat.speech;

import com.example.chat.auth.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** API.md#speech — STT(multipart) / TTS(json → audio/mpeg). 상한·사용량·임시 파일 규칙은 SpeechService (T-009). */
@RestController
@RequestMapping("/speech")
public class SpeechController {

	/** 길이 상한은 서비스가 검사(TEXT_TOO_LONG). 여기선 공백만 막는다(VALIDATION_FAILED details.text). */
	public record TtsRequest(@NotBlank String text, String voice) {}

	private final SpeechService service;

	public SpeechController(SpeechService service) {
		this.service = service;
	}

	/** `audio` 파트가 없으면 required=false 로 받아 서비스가 VALIDATION_FAILED(details.audio) 를 낸다 — 500 이 아니라. */
	@PostMapping(value = "/stt", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public SpeechService.SttResult stt(@AuthenticationPrincipal AuthPrincipal principal,
		@RequestParam(value = "audio", required = false) MultipartFile audio,
		@RequestParam(value = "durationMs", required = false) Long durationMs) {
		return service.stt(principal.userId(), audio, durationMs);
	}

	@PostMapping(value = "/tts", consumes = MediaType.APPLICATION_JSON_VALUE, produces = "audio/mpeg")
	public ResponseEntity<byte[]> tts(@AuthenticationPrincipal AuthPrincipal principal, @RequestBody @Valid TtsRequest body) {
		byte[] audio = service.tts(principal.userId(), body.text(), body.voice());
		return ResponseEntity.ok()
			.contentType(MediaType.parseMediaType("audio/mpeg"))
			.header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")   // API.md#speech 문자열 그대로
			.body(audio);
	}
}
