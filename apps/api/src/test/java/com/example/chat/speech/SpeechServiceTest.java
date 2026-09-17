package com.example.chat.speech;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.example.chat.global.AppProperties;
import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import com.example.chat.message.DailyUsageMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.assertj.core.api.InstanceOfAssertFactories;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

/**
 * T-009 SpeechService 규칙: 임시 파일 저장→변환→삭제, 길이/글자 상한, 사용량 귀속, 공급자 실패 매핑.
 * 공급자는 fake(README "외부 API 는 인터페이스 뒤에"), DB 매퍼는 mock — 매퍼 SQL 은 MapperTest 에서.
 */
class SpeechServiceTest {

	private static final int MAX_AUDIO_SECONDS = 60;
	private static final int MAX_TTS_CHARS = 1000;

	@TempDir Path tmpDir;

	private FakeStt stt;
	private FakeTts tts;
	private DailyUsageMapper usage;
	private SpeechService service;
	private final AppProperties app = new AppProperties("http://localhost:3000", "Asia/Seoul");

	/** 호출 시점의 파일 존재 여부·내용을 기록한다 — "처리 중엔 있고 끝나면 없다"를 검증하기 위해. */
	static class FakeStt implements SttProvider {
		final List<Path> receivedPaths = new ArrayList<>();
		final List<String> receivedContentTypes = new ArrayList<>();
		byte[] bytesAtCall;
		boolean existedAtCall;
		Transcript reply = new Transcript("오늘 날씨 어때", 2_400);
		RuntimeException failWith;

		@Override
		public Transcript transcribe(Path audio, String contentType) {
			receivedPaths.add(audio);
			receivedContentTypes.add(contentType);
			existedAtCall = Files.exists(audio);
			try {
				bytesAtCall = Files.readAllBytes(audio);
			} catch (IOException e) {
				throw new IllegalStateException(e);
			}
			if (failWith != null) throw failWith;
			return reply;
		}

		@Override
		public String name() {
			return "fake-stt";
		}
	}

	static class FakeTts implements TtsProvider {
		String receivedText;
		String receivedVoice;
		byte[] reply = new byte[]{1, 2, 3};
		RuntimeException failWith;

		@Override
		public byte[] synthesize(String text, String voice) {
			receivedText = text;
			receivedVoice = voice;
			if (failWith != null) throw failWith;
			return reply;
		}

		@Override
		public String name() {
			return "fake-tts";
		}
	}

	@BeforeEach
	void setUp() {
		stt = new FakeStt();
		tts = new FakeTts();
		usage = mock(DailyUsageMapper.class);
		SpeechProperties props = new SpeechProperties("fake", "fake", tmpDir.toString(), MAX_AUDIO_SECONDS, MAX_TTS_CHARS,
			"", "https://api.openai.com/v1", "whisper-1", "tts-1", "", "", "", "", "alloy", 30);
		service = new SpeechService(stt, tts, usage, props, app);
	}

	private static MockMultipartFile webm(byte[] bytes) {
		return new MockMultipartFile("audio", "rec.webm", "audio/webm;codecs=opus", bytes);
	}

	private LocalDate today() {
		return LocalDate.now(app.zoneId());
	}

	private List<Path> listTmp() {
		try (var s = Files.list(tmpDir)) {
			return s.toList();
		} catch (IOException e) {
			throw new IllegalStateException(e);
		}
	}

	@Nested
	@DisplayName("stt")
	class Stt {

		@Test
		void 임시_파일에_저장해_공급자에_넘기고_응답_전에_지운다() {
			byte[] bytes = "opus-bytes".getBytes();

			SpeechService.SttResult r = service.stt(7L, webm(bytes), 2_400L);

			assertThat(r.text()).isEqualTo("오늘 날씨 어때");
			assertThat(r.durationMs()).isEqualTo(2_400);
			assertThat(r.provider()).isEqualTo("fake-stt");
			assertThat(stt.existedAtCall).isTrue();
			assertThat(stt.bytesAtCall).isEqualTo(bytes);
			assertThat(stt.receivedPaths.get(0).getParent()).isEqualTo(tmpDir);
			assertThat(stt.receivedPaths.get(0).getFileName().toString()).endsWith(".webm");
			assertThat(stt.receivedContentTypes.get(0)).isEqualTo("audio/webm;codecs=opus");
			assertThat(Files.exists(stt.receivedPaths.get(0))).isFalse();
		}

		@Test
		void 성공하면_공급자_보고_길이를_올림한_초로_사용량에_더한다() {
			stt.reply = new SttProvider.Transcript("안녕", 2_001);

			service.stt(7L, webm(new byte[]{1}), null);

			verify(usage).addSttSeconds(7L, today(), 3);
		}

		@Test
		void 클라이언트_durationMs_가_상한을_넘으면_공급자를_부르지_않고_AUDIO_TOO_LONG() {
			assertThatThrownBy(() -> service.stt(7L, webm(new byte[]{1}), (MAX_AUDIO_SECONDS + 1) * 1000L))
				.isInstanceOf(BusinessException.class)
				.extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.AUDIO_TOO_LONG);

			assertThat(stt.receivedPaths).isEmpty();
			assertThat(listTmp()).isEmpty();
			verify(usage, never()).addSttSeconds(anyLong(), any(), anyInt());
		}

		@Test
		void 공급자가_보고한_길이가_상한을_넘어도_AUDIO_TOO_LONG_이고_파일은_지워진다() {
			stt.reply = new SttProvider.Transcript("긴 말", MAX_AUDIO_SECONDS * 1000L + 1);

			assertThatThrownBy(() -> service.stt(7L, webm(new byte[]{1}), null))
				.isInstanceOf(BusinessException.class)
				.extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.AUDIO_TOO_LONG);

			assertThat(listTmp()).isEmpty();
			verify(usage, never()).addSttSeconds(anyLong(), any(), anyInt());
		}

		@Test
		void 공급자_실패는_SPEECH_UPSTREAM_ERROR_로_바뀌고_파일은_지워진다() {
			stt.failWith = new SpeechException("openai responded 500", null);

			assertThatThrownBy(() -> service.stt(7L, webm(new byte[]{1}), null))
				.isInstanceOf(BusinessException.class)
				.extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.SPEECH_UPSTREAM_ERROR);

			assertThat(listTmp()).isEmpty();
			verify(usage, never()).addSttSeconds(anyLong(), any(), anyInt());
		}

		@Test
		void 빈_파일은_VALIDATION_FAILED_details_audio() {
			assertThatThrownBy(() -> service.stt(7L, webm(new byte[0]), null))
				.isInstanceOf(BusinessException.class)
				.satisfies(e -> {
					BusinessException be = (BusinessException) e;
					assertThat(be.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_FAILED);
					assertThat(be.getDetails()).asInstanceOf(InstanceOfAssertFactories.MAP).containsKey("audio");
				});
			assertThat(stt.receivedPaths).isEmpty();
		}

		@Test
		void 확장자는_content_type_에서_정한다_mp4() {
			MockMultipartFile mp4 = new MockMultipartFile("audio", "blob", "audio/mp4", new byte[]{1});

			service.stt(7L, mp4, null);

			assertThat(stt.receivedPaths.get(0).getFileName().toString()).endsWith(".mp4");
		}
	}

	@Nested
	@DisplayName("tts")
	class Tts {

		@Test
		void 텍스트를_공급자에_넘기고_바이트를_돌려주며_글자수를_사용량에_더한다() {
			byte[] out = service.tts(7L, "안녕, 반가워", "nova");

			assertThat(out).isEqualTo(new byte[]{1, 2, 3});
			assertThat(tts.receivedText).isEqualTo("안녕, 반가워");
			assertThat(tts.receivedVoice).isEqualTo("nova");
			verify(usage).addTtsChars(7L, today(), "안녕, 반가워".length());
		}

		@Test
		void voice_생략_시_설정_기본값() {
			service.tts(7L, "안녕", null);

			assertThat(tts.receivedVoice).isEqualTo("alloy");
		}

		@Test
		void 상한_초과_텍스트는_TEXT_TOO_LONG_이고_공급자를_부르지_않는다() {
			String text = "가".repeat(MAX_TTS_CHARS + 1);

			assertThatThrownBy(() -> service.tts(7L, text, null))
				.isInstanceOf(BusinessException.class)
				.extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.TEXT_TOO_LONG);

			assertThat(tts.receivedText).isNull();
			verify(usage, never()).addTtsChars(anyLong(), any(), anyInt());
		}

		@Test
		void 정확히_상한_글자는_허용() {
			service.tts(7L, "가".repeat(MAX_TTS_CHARS), null);

			assertThat(tts.receivedText).hasSize(MAX_TTS_CHARS);
		}

		@Test
		void 공급자_실패는_SPEECH_UPSTREAM_ERROR_이고_사용량은_안_더한다() {
			tts.failWith = new SpeechException("openai responded 429", null);

			assertThatThrownBy(() -> service.tts(7L, "안녕", null))
				.isInstanceOf(BusinessException.class)
				.extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.SPEECH_UPSTREAM_ERROR);

			verify(usage, never()).addTtsChars(anyLong(), any(), anyInt());
		}
	}
}
