package com.example.chat.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.chat.user.User;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 순수 단위 테스트 — 컨텍스트 없이 생성자로 값 주입 (Admin AdminJwtProviderTest 방식). */
class JwtProviderTest {

	private static final String SECRET = "test-only-secret-key-that-is-at-least-32-bytes-long!!";

	private JwtProvider provider(Duration accessTtl) {
		return new JwtProvider(new JwtProperties(SECRET, accessTtl, Duration.ofDays(30)));
	}

	@Test
	void access_토큰_발급_후_파싱하면_userId_와_role() {
		JwtProvider p = provider(Duration.ofMinutes(15));

		String token = p.createAccessToken(42L, User.Role.ADMIN);
		JwtProvider.AccessClaims claims = p.parseAccessToken(token);

		assertThat(claims.userId()).isEqualTo(42L);
		assertThat(claims.role()).isEqualTo(User.Role.ADMIN);
	}

	@Test
	void 만료된_access_토큰은_ExpiredJwtException() {
		JwtProvider p = provider(Duration.ofSeconds(-10));
		String token = p.createAccessToken(1L, User.Role.USER);

		assertThatThrownBy(() -> p.parseAccessToken(token)).isInstanceOf(ExpiredJwtException.class);
	}

	@Test
	void 변조된_토큰은_JwtException() {
		JwtProvider p = provider(Duration.ofMinutes(15));
		String token = p.createAccessToken(1L, User.Role.USER);
		String tampered = token.substring(0, token.length() - 3) + "abc";

		assertThatThrownBy(() -> p.parseAccessToken(tampered)).isInstanceOf(JwtException.class);
	}

	@Test
	void 다른_secret_으로_서명한_토큰은_JwtException() {
		JwtProvider a = provider(Duration.ofMinutes(15));
		JwtProvider b = new JwtProvider(new JwtProperties(
			"another-secret-key-that-is-at-least-32-bytes-long!!!!", Duration.ofMinutes(15), Duration.ofDays(30)));
		String token = b.createAccessToken(1L, User.Role.USER);

		assertThatThrownBy(() -> a.parseAccessToken(token)).isInstanceOf(JwtException.class);
	}

	@Test
	void 범용_서명_토큰은_audience_가_다르면_access_로_못_쓴다() {
		JwtProvider p = provider(Duration.ofMinutes(15));
		String signed = p.createSignedToken("oauth2-request", Map.of("state", "s1", "nested", Map.of("k", "v")),
			Duration.ofMinutes(5));

		// 같은 키로 서명됐지만 audience 가 달라 access 토큰으로 쓸 수 없다
		assertThatThrownBy(() -> p.parseAccessToken(signed)).isInstanceOf(JwtException.class);

		Map<String, Object> claims = p.parseSignedToken("oauth2-request", signed);
		assertThat(claims.get("state")).isEqualTo("s1");
		assertThat(claims.get("nested")).isEqualTo(Map.of("k", "v"));

		// 반대로 access 토큰을 범용 토큰으로 읽을 수도 없다
		String access = p.createAccessToken(1L, User.Role.USER);
		assertThatThrownBy(() -> p.parseSignedToken("oauth2-request", access)).isInstanceOf(JwtException.class);
	}

	@Test
	void refreshTtl_은_프로퍼티_그대로() {
		assertThat(provider(Duration.ofMinutes(15)).refreshTtl()).isEqualTo(Duration.ofDays(30));
		assertThat(provider(Duration.ofMinutes(15)).accessTtl()).isEqualTo(Duration.ofMinutes(15));
	}
}
