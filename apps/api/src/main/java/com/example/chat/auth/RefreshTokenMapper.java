package com.example.chat.auth;

import java.util.Optional;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** mapper/RefreshTokenMapper.xml. revoke* 는 아직 revoke 되지 않은 행만 갱신하고 갱신 건수를 돌려준다. */
@Mapper
public interface RefreshTokenMapper {

	/** insert 후 id 채워짐 */
	int insert(RefreshToken token);

	/** revoke/만료 여부와 무관하게 조회 — 재사용 감지를 위해 revoke 된 행도 필요 */
	Optional<RefreshToken> findByTokenHash(@Param("tokenHash") String tokenHash);

	int revokeById(@Param("id") Long id);

	int revokeFamily(@Param("familyId") String familyId);

	int revokeAllByUserId(@Param("userId") Long userId);
}
