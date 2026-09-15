package com.example.chat.global.config;

import com.example.chat.auth.AuthCookies;
import com.example.chat.auth.AuthService;
import com.example.chat.auth.CookieProperties;
import com.example.chat.auth.JwtAuthFilter;
import com.example.chat.auth.JwtProvider;
import com.example.chat.auth.RefreshTokenService;
import com.example.chat.auth.oauth2.CookieOAuth2AuthorizationRequestRepository;
import com.example.chat.auth.oauth2.OAuth2FailureHandler;
import com.example.chat.auth.oauth2.OAuth2SuccessHandler;
import com.example.chat.auth.oauth2.SocialOAuth2UserService;
import com.example.chat.global.error.ErrorCode;
import com.example.chat.global.error.ErrorResponse;
import com.example.chat.user.UserMapper;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestRedirectFilter;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * 보안 설정 (T-002 뼈대 + T-004 OAuth2 로그인·JWT 필터).
 *
 * - stateless: JWT 쿠키(D-003). 서버 세션 없음. OAuth2 authorization request 도 세션 대신 서명 쿠키
 *   (CookieOAuth2AuthorizationRequestRepository) — 기본 HttpSession 저장소는 STATELESS 와 충돌한다.
 * - csrf off: 토큰이 HttpOnly 쿠키라 브라우저가 자동 전송한다. 교차 사이트 POST 는 SameSite=Lax 로 막고,
 *   API 는 JSON 본문만 받아(폼 POST 아님) 단순 요청 CSRF 표면을 줄인다.
 * - CORS 설정 없음: 프론트가 같은 오리진 /api 만 호출한다 (D-004).
 * - 401 은 API.md 에러 형식(JSON)으로. 만료 access 는 JwtAuthFilter 가 남긴 attribute 로 TOKEN_EXPIRED.
 * - 구글은 openid scope 를 빼고 profile/email 만 요청해 OIDC(OidcUser) 경로를 타지 않는다 — 3사 모두
 *   DefaultOAuth2UserService 한 경로(SocialOAuth2UserService)로 처리한다.
 * - JwtAuthFilter 는 여기서만 등록한다(@Component 금지 — 서블릿 필터 이중 등록).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http, JwtAuthFilter jwtAuthFilter,
		ClientRegistrationRepository clientRegistrationRepository,
		CookieOAuth2AuthorizationRequestRepository authorizationRequestRepository,
		OAuth2SuccessHandler successHandler, OAuth2FailureHandler failureHandler) throws Exception {
		http
			.csrf(csrf -> csrf.disable())
			.formLogin(form -> form.disable())
			.httpBasic(basic -> basic.disable())
			.logout(logout -> logout.disable())
			.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.exceptionHandling(e -> e.authenticationEntryPoint((request, response, ex) -> {
				Object marker = request.getAttribute(JwtAuthFilter.ATTR_AUTH_ERROR);
				ErrorCode code = marker instanceof ErrorCode c ? c : ErrorCode.UNAUTHENTICATED;
				response.setStatus(code.getStatus().value());
				response.setContentType(MediaType.APPLICATION_JSON_VALUE);
				response.setCharacterEncoding("UTF-8");
				response.getWriter().write(ErrorResponse.of(code).toJson());
			}))
			.oauth2Login(oauth2 -> oauth2
				.authorizationEndpoint(a -> a
					.authorizationRequestRepository(authorizationRequestRepository)
					.authorizationRequestResolver(lenientResolver(clientRegistrationRepository)))
				.userInfoEndpoint(u -> u.userService(new SocialOAuth2UserService()))
				.successHandler(successHandler)
				.failureHandler(failureHandler))
			.addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
			.authorizeHttpRequests(auth -> auth
				// SSE 클라이언트 끊김 등 ASYNC/ERROR 재디스패치는 REQUEST 단계에서 이미 인가됐다. 익명으로 다시 판정하면
				// "response already committed" ERROR 로그만 남긴다(T-007 QA). 시큐리티는 REQUEST 디스패치에서만.
				.dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll()
				// 경로는 context-path(/api) 이후 기준
				.requestMatchers("/actuator/health").permitAll()
				.requestMatchers("/oauth2/**", "/login/**").permitAll()
				.requestMatchers("/auth/refresh", "/auth/logout").permitAll()
				.requestMatchers("/admin/**").hasRole("ADMIN")
				.anyRequest().authenticated());

		return http.build();
	}

	/**
	 * 기본 resolver 는 모르는 registrationId(/oauth2/authorization/github) 에 InvalidClientRegistrationIdException
	 * (package-private, IllegalArgumentException 하위) 을 던져 500 이 된다. null 을 돌려주면 필터가 건너뛰어 일반 404.
	 */
	private static OAuth2AuthorizationRequestResolver lenientResolver(ClientRegistrationRepository registrations) {
		DefaultOAuth2AuthorizationRequestResolver delegate = new DefaultOAuth2AuthorizationRequestResolver(
			registrations, OAuth2AuthorizationRequestRedirectFilter.DEFAULT_AUTHORIZATION_REQUEST_BASE_URI);
		return new OAuth2AuthorizationRequestResolver() {
			@Override
			public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
				try {
					return delegate.resolve(request);
				} catch (IllegalArgumentException e) {
					return null;
				}
			}

			@Override
			public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
				try {
					return delegate.resolve(request, clientRegistrationId);
				} catch (IllegalArgumentException e) {
					return null;
				}
			}
		};
	}

	@Bean
	public JwtAuthFilter jwtAuthFilter(JwtProvider jwtProvider, UserMapper userMapper) {
		return new JwtAuthFilter(jwtProvider, userMapper);
	}

	/** Boot 는 Filter 타입 bean 을 서블릿 필터로도 자동 등록한다 → 시큐리티 체인 안에서만 돌도록 비활성화. */
	@Bean
	public FilterRegistrationBean<JwtAuthFilter> jwtAuthFilterRegistration(JwtAuthFilter filter) {
		FilterRegistrationBean<JwtAuthFilter> registration = new FilterRegistrationBean<>(filter);
		registration.setEnabled(false);
		return registration;
	}

	@Bean
	public CookieOAuth2AuthorizationRequestRepository authorizationRequestRepository(JwtProvider jwtProvider,
		CookieProperties cookieProperties) {
		return new CookieOAuth2AuthorizationRequestRepository(jwtProvider, cookieProperties);
	}

	@Bean
	public OAuth2SuccessHandler oauth2SuccessHandler(AuthService authService, RefreshTokenService refreshTokenService,
		JwtProvider jwtProvider, AuthCookies cookies, @Value("${app.base-url}") String baseUrl) {
		return new OAuth2SuccessHandler(authService, refreshTokenService, jwtProvider, cookies, baseUrl);
	}

	@Bean
	public OAuth2FailureHandler oauth2FailureHandler(@Value("${app.base-url}") String baseUrl) {
		return new OAuth2FailureHandler(baseUrl);
	}
}
