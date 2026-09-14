package com.example.chat.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.chat.global.error.ErrorCode;
import com.example.chat.user.User;
import com.example.chat.user.UserMapper;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** 필터 단위 테스트 — Mock 서블릿 객체로 직접 호출 (Admin AdminAuthFilterTest 방식). */
class JwtAuthFilterTest {

	private final JwtProvider jwt = new JwtProvider(new JwtProperties(
		"test-only-secret-key-that-is-at-least-32-bytes-long!!", Duration.ofMinutes(15), Duration.ofDays(30)));
	private final UserMapper userMapper = mock(UserMapper.class);
	private final JwtAuthFilter filter = new JwtAuthFilter(jwt, userMapper);

	@BeforeEach
	@AfterEach
	void clearContext() {
		SecurityContextHolder.clearContext();
	}

	private MockHttpServletRequest request(String path, String accessToken) {
		MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api" + path);
		req.setContextPath("/api");
		if (accessToken != null) {
			req.setCookies(new Cookie(AuthCookies.ACCESS, accessToken));
		}
		return req;
	}

	private User user(User.Status status, User.Role role) {
		return User.builder().id(7L).nickname("n").status(status).role(role).build();
	}

	@Test
	void 쿠키_없으면_인증_없이_통과() throws Exception {
		MockFilterChain chain = new MockFilterChain();
		filter.doFilter(request("/rooms", null), new MockHttpServletResponse(), chain);

		assertThat(chain.getRequest()).isNotNull();
		assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
	}

	@Test
	void 유효한_토큰이면_SecurityContext_에_principal_과_ROLE_권한() throws Exception {
		when(userMapper.findById(7L)).thenReturn(Optional.of(user(User.Status.ACTIVE, User.Role.ADMIN)));
		MockFilterChain chain = new MockFilterChain();

		filter.doFilter(request("/rooms", jwt.createAccessToken(7L, User.Role.ADMIN)), new MockHttpServletResponse(), chain);

		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		assertThat(auth).isNotNull();
		assertThat(auth.getPrincipal()).isInstanceOf(AuthPrincipal.class);
		AuthPrincipal principal = (AuthPrincipal) auth.getPrincipal();
		assertThat(principal.userId()).isEqualTo(7L);
		assertThat(principal.role()).isEqualTo(User.Role.ADMIN);
		assertThat(auth.getAuthorities()).extracting("authority").containsExactly("ROLE_ADMIN");
		assertThat(chain.getRequest()).isNotNull();
	}

	@Test
	void 만료_토큰이면_인증_없이_통과하고_TOKEN_EXPIRED_속성() throws Exception {
		JwtProvider expired = new JwtProvider(new JwtProperties(
			"test-only-secret-key-that-is-at-least-32-bytes-long!!", Duration.ofSeconds(-1), Duration.ofDays(30)));
		MockHttpServletRequest req = request("/rooms", expired.createAccessToken(7L, User.Role.USER));
		MockFilterChain chain = new MockFilterChain();

		filter.doFilter(req, new MockHttpServletResponse(), chain);

		assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
		assertThat(req.getAttribute(JwtAuthFilter.ATTR_AUTH_ERROR)).isEqualTo(ErrorCode.TOKEN_EXPIRED);
		assertThat(chain.getRequest()).isNotNull();
	}

	@Test
	void 변조_토큰이면_인증_없이_통과() throws Exception {
		MockHttpServletRequest req = request("/rooms", "not.a.jwt");
		MockFilterChain chain = new MockFilterChain();

		filter.doFilter(req, new MockHttpServletResponse(), chain);

		assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
		assertThat(req.getAttribute(JwtAuthFilter.ATTR_AUTH_ERROR)).isNull();
		assertThat(chain.getRequest()).isNotNull();
	}

	@Test
	void 토큰은_유효하지만_사용자가_없으면_탈퇴_인증_없이_통과() throws Exception {
		when(userMapper.findById(anyLong())).thenReturn(Optional.empty());
		MockFilterChain chain = new MockFilterChain();

		filter.doFilter(request("/rooms", jwt.createAccessToken(7L, User.Role.USER)), new MockHttpServletResponse(), chain);

		assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
		assertThat(chain.getRequest()).isNotNull();
	}

	@Test
	void 정지_회원은_auth_me_외_경로에서_403_USER_SUSPENDED_JSON() throws Exception {
		when(userMapper.findById(7L)).thenReturn(Optional.of(user(User.Status.SUSPENDED, User.Role.USER)));
		MockHttpServletResponse res = new MockHttpServletResponse();
		MockFilterChain chain = new MockFilterChain();

		filter.doFilter(request("/rooms", jwt.createAccessToken(7L, User.Role.USER)), res, chain);

		assertThat(res.getStatus()).isEqualTo(403);
		assertThat(res.getContentType()).startsWith("application/json");
		assertThat(res.getContentAsString()).contains("\"code\":\"USER_SUSPENDED\"");
		assertThat(chain.getRequest()).isNull();   // 체인 중단
	}

	@Test
	void 정지_회원도_auth_me_는_인증되어_통과() throws Exception {
		when(userMapper.findById(7L)).thenReturn(Optional.of(user(User.Status.SUSPENDED, User.Role.USER)));
		MockFilterChain chain = new MockFilterChain();

		filter.doFilter(request("/auth/me", jwt.createAccessToken(7L, User.Role.USER)), new MockHttpServletResponse(), chain);

		AuthPrincipal principal = (AuthPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
		assertThat(principal.status()).isEqualTo(User.Status.SUSPENDED);
		assertThat(chain.getRequest()).isNotNull();
	}

	@Test
	void role_은_토큰이_아니라_DB_기준() throws Exception {
		// 토큰 발급 후 권한이 바뀌어도 DB 가 기준 (즉시 반영)
		when(userMapper.findById(7L)).thenReturn(Optional.of(user(User.Status.ACTIVE, User.Role.USER)));

		filter.doFilter(request("/rooms", jwt.createAccessToken(7L, User.Role.ADMIN)), new MockHttpServletResponse(),
			new MockFilterChain());

		assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities())
			.extracting("authority").containsExactly("ROLE_USER");
	}
}
