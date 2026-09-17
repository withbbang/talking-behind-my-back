package com.example.chat.speech;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.chat.auth.AuthCookies;
import com.example.chat.auth.JwtProvider;
import com.example.chat.global.AppProperties;
import com.example.chat.message.DailyUsage;
import com.example.chat.message.DailyUsageMapper;
import com.example.chat.user.User;
import com.example.chat.user.UserMapper;
import jakarta.servlet.http.Cookie;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** /speech/stt · /speech/tts HTTP 계약 (API.md#speech). 실제 SecurityConfig 위에서, 공급자는 FakeSpeechTestConfig. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(FakeSpeechTestConfig.class)
@Transactional
class SpeechControllerIntegrationTest {

	@Autowired MockMvc mvc;
	@Autowired JwtProvider jwtProvider;
	@Autowired UserMapper userMapper;
	@Autowired DailyUsageMapper usageMapper;
	@Autowired AppProperties appProps;
	@Autowired org.springframework.core.env.Environment env;
	@Autowired FakeSpeechTestConfig.FakeStt stt;
	@Autowired FakeSpeechTestConfig.FakeTts tts;

	private User me;

	@BeforeEach
	void setUp() {
		stt.reset();
		tts.reset();
		me = User.builder().nickname("나").build();
		userMapper.insert(me);
	}

	private Cookie access(User u) {
		return new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(u.getId(), u.getRole()));
	}

	private static MockMultipartFile audio(byte[] bytes) {
		return new MockMultipartFile("audio", "rec.webm", "audio/webm;codecs=opus", bytes);
	}

	private DailyUsage usageToday() {
		return usageMapper.find(me.getId(), LocalDate.now(appProps.zoneId())).orElse(DailyUsage.builder().build());
	}

	@Nested
	@DisplayName("POST /speech/stt")
	class Stt {

		@Test
		void 미인증_401() throws Exception {
			mvc.perform(multipart("/speech/stt").file(audio(new byte[]{1})))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
			assertThat(stt.calls).isZero();
		}

		@Test
		void 정지_회원_403() throws Exception {
			userMapper.updateStatus(me.getId(), User.Status.SUSPENDED);

			mvc.perform(multipart("/speech/stt").file(audio(new byte[]{1})).cookie(access(me)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("USER_SUSPENDED"));
			assertThat(stt.calls).isZero();
		}

		@Test
		void 성공_200_text_durationMs_provider_그리고_stt_seconds_누적() throws Exception {
			stt.reply = new SttProvider.Transcript("오늘 날씨 어때", 2_400);

			mvc.perform(multipart("/speech/stt").file(audio(new byte[]{1, 2})).param("durationMs", "2300").cookie(access(me)))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$.text").value("오늘 날씨 어때"))
				.andExpect(jsonPath("$.durationMs").value(2400))
				.andExpect(jsonPath("$.provider").value("fake"));

			assertThat(usageToday().getSttSeconds()).isEqualTo(3);
		}

		@Test
		void audio_파트_없음_400_VALIDATION_FAILED_details_audio() throws Exception {
			mvc.perform(multipart("/speech/stt").cookie(access(me)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.details.audio").exists());
			assertThat(stt.calls).isZero();
		}

		@Test
		void durationMs_상한_초과_400_AUDIO_TOO_LONG() throws Exception {
			mvc.perform(multipart("/speech/stt").file(audio(new byte[]{1})).param("durationMs", "60001").cookie(access(me)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("AUDIO_TOO_LONG"));
			assertThat(stt.calls).isZero();
			assertThat(usageToday().getSttSeconds()).isZero();
		}

		@Test
		void durationMs_가_숫자가_아니면_400_VALIDATION_FAILED_details_durationMs() throws Exception {
			mvc.perform(multipart("/speech/stt").file(audio(new byte[]{1})).param("durationMs", "abc").cookie(access(me)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.details.durationMs").exists());
			assertThat(stt.calls).isZero();
		}

		@Test
		void Tomcat_multipart_임시_위치가_tmp_dir_과_같은_절대_경로다_D007_tmpfs() {
			String location = env.getProperty("spring.servlet.multipart.location");
			String tmpDir = env.getProperty("app.speech.tmp-dir");
			assertThat(location).isNotBlank().isEqualTo(tmpDir);
			assertThat(java.nio.file.Path.of(location).isAbsolute()).isTrue();
		}

		@Test
		void 공급자_실패_502_SPEECH_UPSTREAM_ERROR() throws Exception {
			stt.failWith = new SpeechException("omniroute stt responded 500", null);

			mvc.perform(multipart("/speech/stt").file(audio(new byte[]{1})).cookie(access(me)))
				.andExpect(status().isBadGateway())
				.andExpect(jsonPath("$.code").value("SPEECH_UPSTREAM_ERROR"));
			assertThat(usageToday().getSttSeconds()).isZero();
		}
	}

	@Nested
	@DisplayName("POST /speech/tts")
	class Tts {

		@Test
		void 미인증_401() throws Exception {
			mvc.perform(post("/speech/tts").contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"안녕\"}"))
				.andExpect(status().isUnauthorized());
			assertThat(tts.lastText).isNull();
		}

		@Test
		void 성공_200_audio_mpeg_private_cache_그리고_tts_chars_누적() throws Exception {
			mvc.perform(post("/speech/tts").contentType(MediaType.APPLICATION_JSON)
					.content("{\"text\":\"안녕, 반가워\",\"voice\":\"nova\"}").cookie(access(me)))
				.andExpect(status().isOk())
				.andExpect(header().string("Content-Type", "audio/mpeg"))
				.andExpect(header().string("Cache-Control", "private, max-age=3600"))
				.andExpect(content().bytes(new byte[]{(byte) 0xFF, (byte) 0xFB, 1, 2, 3}));

			assertThat(tts.lastText).isEqualTo("안녕, 반가워");
			assertThat(tts.lastVoice).isEqualTo("nova");
			assertThat(usageToday().getTtsChars()).isEqualTo("안녕, 반가워".length());
		}

		@Test
		void voice_생략_시_설정_기본값() throws Exception {
			mvc.perform(post("/speech/tts").contentType(MediaType.APPLICATION_JSON)
					.content("{\"text\":\"안녕\"}").cookie(access(me)))
				.andExpect(status().isOk());

			assertThat(tts.lastVoice).isEqualTo("ko-KR-SunHiNeural");   // application.yml 기본값 (D-028)
		}

		@Test
		void 공백_텍스트_400_VALIDATION_FAILED_details_text() throws Exception {
			mvc.perform(post("/speech/tts").contentType(MediaType.APPLICATION_JSON)
					.content("{\"text\":\"   \"}").cookie(access(me)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.details.text").exists());
			assertThat(tts.lastText).isNull();
		}

		@Test
		void 상한_초과_400_TEXT_TOO_LONG() throws Exception {
			String text = "가".repeat(1001);

			mvc.perform(post("/speech/tts").contentType(MediaType.APPLICATION_JSON)
					.content("{\"text\":\"" + text + "\"}").cookie(access(me)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("TEXT_TOO_LONG"));
			assertThat(tts.lastText).isNull();
			assertThat(usageToday().getTtsChars()).isZero();
		}

		@Test
		void 공급자_실패_502_SPEECH_UPSTREAM_ERROR() throws Exception {
			tts.failWith = new SpeechException("omniroute tts responded 429", null);

			mvc.perform(post("/speech/tts").contentType(MediaType.APPLICATION_JSON)
					.content("{\"text\":\"안녕\"}").cookie(access(me)))
				.andExpect(status().isBadGateway())
				.andExpect(jsonPath("$.code").value("SPEECH_UPSTREAM_ERROR"));
			assertThat(usageToday().getTtsChars()).isZero();
		}
	}
}
