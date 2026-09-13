package com.example.chat.persona;

import java.util.List;
import java.util.Optional;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** mapper/PersonaMapper.xml. 활성 1개 보장은 서비스 트랜잭션에서 deactivateAll → activate 순서로. */
@Mapper
public interface PersonaMapper {

	Optional<Persona> findActive();

	Optional<Persona> findById(@Param("id") Long id);

	List<Persona> findAll();

	int insert(Persona persona);

	int update(Persona persona);

	int deactivateAll();

	int activate(@Param("id") Long id);

	int deleteById(@Param("id") Long id);
}
