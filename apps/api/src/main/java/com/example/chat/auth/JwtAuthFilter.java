package com.example.chat.auth;

import com.example.chat.global.error.ErrorCode;
import com.example.chat.global.error.ErrorResponse;
import com.example.chat.user.User;
import com.example.chat.user.UserMapper;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * access 쿠키 → SecurityContext (D-003). SecurityConfig 가 UsernamePasswordAuthenticationFilter 앞에 등록한다.
 * @Component 를 붙이지 않는다 — Boot 가 서블릿 필터로도 자동 등록해 두 번 실행되기 때문(Admin FilterRegistrationBean 교훈).
 *
 * - 쿠키 없음/변조 → 인증 없이 통과. 보호 경로면 entrypoint 가 401 UNAUTHENTICATED.
 * - 만료 → 인증 없이 통과 + request attribute(ATTR_AUTH_ERROR)=TOKEN_EXPIRED. entrypoint 가 이 코드로 401.
 *   프론트 api.ts 는 401 이면 refresh 를 시도하므로 두 코드 모두 같은 흐름을 탄다.
 * - 사용자는 매 요청 DB 조회 — 정지/탈퇴/권한 변경이 즉시 반영된다(토큰 claim 은 최대 15분 지연).
 * - 정지 회원: /auth/me 는 통과(프론트가 정지 안내를 띄울 수 있게), 그 외는 403 USER_SUSPENDED 로 체인 중단.
 */
public class JwtAuthFilter extends OncePerRequestFilter {

	public static final String ATTR_AUTH_ERROR = JwtAuthFilter.class.getName() + ".AUTH_ERROR";
	/** context-path(/api) 를 뺀 경로. 정지 회원도 허용되는 유일한 경로. */
	static final String ME_PATH = "/auth/me";

	private final JwtProvider jwtProvider;
	private final UserMapper userMapper;

	public JwtAuthFilter(JwtProvider jwtProvider, UserMapper userMapper) {
		this.jwtProvider = jwtProvider;
		this.userMapper = userMapper;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
		throws ServletException, IOException {

		Optional<String> token = AuthCookies.read(request, AuthCookies.ACCESS);
		if (token.isEmpty()) {
			chain.doFilter(request, response);
			return;
		}

		JwtProvider.AccessClaims claims;
		try {
			claims = jwtProvider.parseAccessToken(token.get());
		} catch (ExpiredJwtException e) {
			request.setAttribute(ATTR_AUTH_ERROR, ErrorCode.TOKEN_EXPIRED);
			chain.doFilter(request, response);
			return;
		} catch (JwtException | IllegalArgumentException e) {
			chain.doFilter(request, response);
			return;
		}

		Optional<User> user = userMapper.findById(claims.userId());
		if (user.isEmpty()) {
			chain.doFilter(request, response);
			return;
		}

		AuthPrincipal principal = AuthPrincipal.of(user.get());
		if (principal.isSuspended() && !ME_PATH.equals(pathWithinContext(request))) {
			response.setStatus(ErrorCode.USER_SUSPENDED.getStatus().value());
			response.setContentType(MediaType.APPLICATION_JSON_VALUE);
			response.setCharacterEncoding("UTF-8");
			response.getWriter().write(ErrorResponse.of(ErrorCode.USER_SUSPENDED).toJson());
			return;
		}

		UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
			principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + principal.role().name())));
		auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
		SecurityContextHolder.getContext().setAuthentication(auth);

		chain.doFilter(request, response);
	}

	private static String pathWithinContext(HttpServletRequest request) {
		String uri = request.getRequestURI();
		String ctx = request.getContextPath();
		return (ctx != null && !ctx.isEmpty() && uri.startsWith(ctx)) ? uri.substring(ctx.length()) : uri;
	}
}
