package com.example.chat.persona;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** personas (SCHEMA.md #6). 활성은 정확히 1개 — PersonaMapper.deactivateAll + activate 를 한 트랜잭션에서. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Persona {

	private Long id;
	private String name;
	private String systemPrompt;
	@Builder.Default
	private boolean active = false;
	private LocalDateTime createdAt;
	private LocalDateTime updatedAt;
}
