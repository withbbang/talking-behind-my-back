package com.example.chat.user;

import java.util.Optional;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** mapper/UserMapper.xml. soft delete 된 사용자는 findById 에서 제외. */
@Mapper
public interface UserMapper {

	/** insert 후 user.id 채워짐 */
	int insert(User user);

	Optional<User> findById(@Param("id") Long id);

	int updateLastLoginAt(@Param("id") Long id);

	int updateStatus(@Param("id") Long id, @Param("status") User.Status status);

	int updateNickname(@Param("id") Long id, @Param("nickname") String nickname);
}
