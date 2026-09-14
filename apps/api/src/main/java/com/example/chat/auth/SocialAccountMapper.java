package com.example.chat.auth;

import java.util.Optional;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** mapper/SocialAccountMapper.xml */
@Mapper
public interface SocialAccountMapper {

	/** insert 후 id 채워짐. (provider, provider_user_id) UNIQUE 위반 시 DuplicateKeyException */
	int insert(SocialAccount socialAccount);

	Optional<SocialAccount> findByProviderAndProviderUserId(
		@Param("provider") SocialAccount.Provider provider,
		@Param("providerUserId") String providerUserId);

	/** v1 은 사용자당 1개 */
	Optional<SocialAccount> findByUserId(@Param("userId") Long userId);
}
