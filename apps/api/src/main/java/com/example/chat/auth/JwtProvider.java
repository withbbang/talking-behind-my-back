package com.example.chat.auth;

import com.example.chat.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;

/**
 * JWT(HS256) 발급·검증 (D-003). Admin AdminJwtProvider 와 같은 패턴.
 *
 * - access 토큰: subject=userId, role 클레임, audience=access. 만료는 ExpiredJwtException 으로 구분한다.
 * - 범용 서명 토큰: OAuth2 authorization request 쿠키(CookieOAuth2AuthorizationRequestRepository) 처럼
 *   "서버가 만들었고 변조되지 않았음"만 보장하면 되는 값에 쓴다. audience 로 access 토큰과 상호 대체를 막는다.
 * - 순수 단위 테스트가 가능하도록 생성자에서 프로퍼티를 받는다.
 */
@Component
public class JwtProvider {

	public static final String AUD_ACCESS = "access";
	static final String CLAIM_ROLE = "role";

	public record AccessClaims(Long userId, User.Role role) {
	}

	private final SecretKey key;
	private final JwtProperties props;

	public JwtProvider(JwtProperties props) {
		// HS256 은 32byte 이상 키 요구 — 짧으면 여기서 예외 → 기동 시 바로 드러남
		this.key = Keys.hmacShaKeyFor(props.secret().getBytes(StandardCharsets.UTF_8));
		this.props = props;
	}

	public Duration accessTtl() {
		return props.accessTtl();
	}

	public Duration refreshTtl() {
		return props.refreshTtl();
	}

	public String createAccessToken(Long userId, User.Role role) {
		Instant now = Instant.now();
		return Jwts.builder()
			.subject(String.valueOf(userId))
			.audience().add(AUD_ACCESS).and()
			.claim(CLAIM_ROLE, role.name())
			.issuedAt(Date.from(now))
			.expiration(Date.from(now.plus(props.accessTtl())))
			.signWith(key)
			.compact();
	}

	/** 서명·만료·audience 검증. 만료는 ExpiredJwtException, 그 외 문제는 JwtException. */
	public AccessClaims parseAccessToken(String token) {
		Claims claims = parse(token, AUD_ACCESS);
		return new AccessClaims(Long.valueOf(claims.getSubject()), User.Role.valueOf(claims.get(CLAIM_ROLE, String.class)));
	}

	/** audience 로 용도를 구분하는 범용 서명 토큰. claims 는 JSON 으로 직렬화 가능한 값만. */
	public String createSignedToken(String audience, Map<String, Object> claims, Duration ttl) {
		Instant now = Instant.now();
		return Jwts.builder()
			.audience().add(audience).and()
			.claims(new HashMap<>(claims))
			.issuedAt(Date.from(now))
			.expiration(Date.from(now.plus(ttl)))
			.signWith(key)
			.compact();
	}

	/** createSignedToken 의 역. audience 불일치·변조·만료는 JwtException. */
	public Map<String, Object> parseSignedToken(String audience, String token) {
		return new HashMap<>(parse(token, audience));
	}

	private Claims parse(String token, String audience) {
		Claims claims = Jwts.parser()
			.verifyWith(key)
			.build()
			.parseSignedClaims(token)
			.getPayload();
		Set<String> aud = claims.getAudience();
		if (aud == null || !aud.contains(audience)) {
			throw new JwtException("audience mismatch");
		}
		return claims;
	}
}
