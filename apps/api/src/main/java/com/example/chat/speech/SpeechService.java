package com.example.chat.speech;

import com.example.chat.global.AppProperties;
import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import com.example.chat.message.DailyUsageMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * API.md#speech 규칙 (T-009, D-026).
 * STT: 상한 검사(클라이언트 durationMs) → tmp-dir 저장 → 공급자 → 상한 재검사(공급자 보고 길이) → 사용량. 파일은 어떤 경로든 응답 전에 지운다.
 * TTS: 글자 상한 → 공급자 → 사용량. 오디오/본문은 로그에 남기지 않는다 (CONVENTIONS.md#공통).
 */
@Slf4j
@Service
public class SpeechService {

	public record SttResult(String text, long durationMs, String provider) {}

	private final SttProvider stt;
	private final TtsProvider tts;
	private final DailyUsageMapper usage;
	private final SpeechProperties props;
	private final AppProperties appProps;

	public SpeechService(SttProvider stt, TtsProvider tts, DailyUsageMapper usage, SpeechProperties props, AppProperties appProps) {
		this.stt = stt;
		this.tts = tts;
		this.usage = usage;
		this.props = props;
		this.appProps = appProps;
	}

	public SttResult stt(Long userId, MultipartFile audio, Long clientDurationMs) {
		if (audio == null || audio.isEmpty()) {
			throw new BusinessException(ErrorCode.VALIDATION_FAILED, ErrorCode.VALIDATION_FAILED.getDefaultMessage(),
				Map.of("audio", "오디오가 비어 있습니다."));
		}
		if (clientDurationMs != null && clientDurationMs > props.maxAudioMs()) {
			throw new BusinessException(ErrorCode.AUDIO_TOO_LONG);
		}
		String contentType = audio.getContentType();
		Path file = newTmpFile(extensionOf(contentType, audio.getOriginalFilename()));
		try {
			audio.transferTo(file);
			SttProvider.Transcript t;
			try {
				t = stt.transcribe(file, contentType);
			} catch (SpeechException e) {
				log.warn("stt upstream failed: {}", e.getMessage());
				throw new BusinessException(ErrorCode.SPEECH_UPSTREAM_ERROR);
			}
			if (t.durationMs() > props.maxAudioMs()) {
				throw new BusinessException(ErrorCode.AUDIO_TOO_LONG);
			}
			// 공급자가 길이를 안 주면(OmniRoute 가 verbose_json 미지원 공급자로 보낸 경우) 클라이언트 실측으로 대신한다
			long durationMs = t.durationMs() > 0 ? t.durationMs() : (clientDurationMs != null ? clientDurationMs : 0);
			if (durationMs > 0) usage.addSttSeconds(userId, today(), ceilSeconds(durationMs));
			return new SttResult(t.text(), durationMs, stt.name());
		} catch (IOException e) {
			throw new IllegalStateException("audio tmp write failed", e);
		} finally {
			deleteQuietly(file);
		}
	}

	public byte[] tts(Long userId, String text, String voice) {
		if (text.length() > props.maxTtsChars()) {
			throw new BusinessException(ErrorCode.TEXT_TOO_LONG);
		}
		String v = voice == null || voice.isBlank() ? props.ttsVoice() : voice;
		byte[] out;
		try {
			out = tts.synthesize(text, v);
		} catch (SpeechException e) {
			log.warn("tts upstream failed: {}", e.getMessage());
			throw new BusinessException(ErrorCode.SPEECH_UPSTREAM_ERROR);
		}
		usage.addTtsChars(userId, today(), text.length());
		return out;
	}

	private Path newTmpFile(String ext) {
		Path dir = Path.of(props.tmpDir());
		try {
			Files.createDirectories(dir);
		} catch (IOException e) {
			throw new IllegalStateException("audio tmp dir unavailable: " + dir, e);
		}
		return dir.resolve(UUID.randomUUID() + "." + ext);
	}

	/** 공급자가 확장자로 포맷을 판별하므로 content-type 우선, 없으면 원본 파일명, 그것도 없으면 bin. */
	static String extensionOf(String contentType, String originalFilename) {
		String mime = contentType == null ? "" : contentType.split(";")[0].trim().toLowerCase();
		switch (mime) {
			case "audio/webm", "video/webm": return "webm";
			case "audio/mp4", "audio/x-m4a", "audio/m4a", "video/mp4": return "mp4";
			case "audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave": return "wav";
			case "audio/mpeg", "audio/mp3": return "mp3";
			case "audio/ogg": return "ogg";
			default: break;
		}
		if (originalFilename != null) {
			int dot = originalFilename.lastIndexOf('.');
			if (dot > 0 && dot < originalFilename.length() - 1) {
				String ext = originalFilename.substring(dot + 1).toLowerCase();
				if (ext.matches("[a-z0-9]{1,5}")) return ext;
			}
		}
		return "bin";
	}

	private static int ceilSeconds(long ms) {
		return (int) ((ms + 999) / 1000);
	}

	private static void deleteQuietly(Path file) {
		try {
			Files.deleteIfExists(file);
		} catch (IOException e) {
			log.warn("audio tmp delete failed: {}", file.getFileName());
		}
	}

	private LocalDate today() {
		return LocalDate.now(appProps.zoneId());
	}
}
