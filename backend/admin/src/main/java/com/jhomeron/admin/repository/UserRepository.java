package com.jhomeron.admin.repository;

import com.jhomeron.admin.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.rest.core.annotation.RepositoryRestResource;

// exported = false: el CRUD real vive en UserController (hashea password con
// bcrypt antes de guardar). Sin esto, Spring Data REST expone /api/users con
// INSERT/UPDATE crudo que guardaría contraseñas en texto plano.
@RepositoryRestResource(collectionResourceRel = "users", path = "users", exported = false)
public interface UserRepository extends JpaRepository<User, Long> {
    User findByUsername(String username);
}
