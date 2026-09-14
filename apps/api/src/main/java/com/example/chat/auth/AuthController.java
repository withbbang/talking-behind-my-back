package com.example.chat.auth;

import com.example.chat.global.error.BusinessException;
import com.example.chat.global.error.ErrorCode;
import com.example.chat.global.error.ErrorResponse;
import com.example.chat.user.User;
import com.example.chat.user.UserMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * /auth/* (API.md#auth). 로그인 시작·콜백은 Spring OAuth2 필터(/oauth2/authorization/*, /login/oauth2/code/*).
 *
 * - GET  /auth/me      : JwtAuthFilter 가 세운 principal 로 조회. 미인증은 entrypoint 가 401.
 * - POST /auth/refresh : refresh 쿠키 회전. 실패(재사용/만료/없음)는 쿠키를 지우고 401 — 프론트는 /login 으로.
 * - POST /auth/logout  : refresh family revoke + 쿠키 삭제. 인증 없이도 호출 가능(access 만료 뒤에도 정리되게).
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

	private final AuthService authService;
	private final RefreshTokenService refreshTokenService;
	private final JwtProvider jwtProvider;
	private final AuthCookies cookies;
	private final UserMapper userMapper;

	public AuthController(AuthService authService, RefreshTokenService refreshTokenService, JwtProvider jwtProvider,
		AuthCookies cookies, UserMapper userMapper) {
		this.authService = authService;
		this.refreshTokenService = refreshTokenService;
		this.jwtProvider = jwtProvider;
		this.cookies = cookies;
		this.userMapper = userMapper;
	}

	@GetMapping("/me")
	public AuthService.Me me(@AuthenticationPrincipal AuthPrincipal principal) {
		return authService.me(principal.userId());
	}

	@PostMapping("/refresh")
	public ResponseEntity<?> refresh(HttpServletRequest request) {
		Optional<String> raw = AuthCookies.read(request, AuthCookies.REFRESH);
		try {
			RefreshTokenService.Rotated rotated = refreshTokenService.rotate(
				raw.orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHENTICATED)));
			User user = userMapper.findById(rotated.userId())
				.orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHENTICATED));
			String access = jwtProvider.createAccessToken(user.getId(), user.getRole());
			return ResponseEntity.noContent()
				.header(HttpHeaders.SET_COOKIE, cookies.access(access).toString())
				.header(HttpHeaders.SET_COOKIE, cookies.refresh(rotated.rawToken()).toString())
				.build();
		} catch (BusinessException e) {
			// 실패한 refresh 쿠키를 남겨두면 프론트가 계속 재시도한다 → 쿠키를 지우면서 API.md 에러 형식으로 응답
			ErrorCode code = e.getErrorCode();
			return ResponseEntity.status(code.getStatus())
				.header(HttpHeaders.SET_COOKIE, cookies.expiredAccess().toString())
				.header(HttpHeaders.SET_COOKIE, cookies.expiredRefresh().toString())
				.body(ErrorResponse.of(code, e.getMessage(), e.getDetails()));
		}
	}

	@PostMapping("/logout")
	public ResponseEntity<Void> logout(HttpServletRequest request) {
		AuthCookies.read(request, AuthCookies.REFRESH).ifPresent(refreshTokenService::revoke);
		return ResponseEntity.noContent()
			.header(HttpHeaders.SET_COOKIE, cookies.expiredAccess().toString())
			.header(HttpHeaders.SET_COOKIE, cookies.expiredRefresh().toString())
			.build();
	}
}
