package com.example.chat.global.config;

import com.example.chat.global.error.ErrorCode;
import com.example.chat.global.error.ErrorResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * 보안 뼈대 (T-002). OAuth2 로그인·JWT 필터는 T-004 에서 여기에 붙는다.
 *
 * - stateless: JWT 쿠키(D-003). 서버 세션 없음.
 * - csrf off: 토큰이 HttpOnly 쿠키라 브라우저가 자동 전송한다. 교차 사이트 POST 는 SameSite=Lax 로 막고,
 *   API 는 JSON 본문만 받아(폼 POST 아님) 단순 요청 CSRF 표면을 줄인다. T-004 에서 재검토.
 * - CORS 설정 없음: 프론트가 같은 오리진 /api 만 호출한다 (D-004).
 * - 401 은 API.md 에러 형식(JSON)으로. 기본 리다이렉트/Basic 챌린지 없음.
 * - T-004 주의: OAuth2 authorization request 저장소가 기본 HttpSession 이라 stateless 와 충돌 →
 *   cookie 기반 AuthorizationRequestRepository 로 교체해야 한다.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
		http
			.csrf(csrf -> csrf.disable())
			.formLogin(form -> form.disable())
			.httpBasic(basic -> basic.disable())
			.logout(logout -> logout.disable())
			.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.exceptionHandling(e -> e.authenticationEntryPoint((request, response, ex) -> {
				response.setStatus(401);
				response.setContentType(MediaType.APPLICATION_JSON_VALUE);
				response.setCharacterEncoding("UTF-8");
				response.getWriter().write(ErrorResponse.of(ErrorCode.UNAUTHENTICATED).toJson());
			}))
			.authorizeHttpRequests(auth -> auth
				// 경로는 context-path(/api) 이후 기준
				.requestMatchers("/actuator/health").permitAll()
				.requestMatchers("/oauth2/**", "/login/**").permitAll()
				.requestMatchers("/auth/refresh").permitAll()
				.requestMatchers("/admin/**").hasRole("ADMIN")
				.anyRequest().authenticated());

		return http.build();
	}
}
