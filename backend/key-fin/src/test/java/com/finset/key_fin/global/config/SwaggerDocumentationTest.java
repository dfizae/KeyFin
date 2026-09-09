package com.finset.key_fin.global.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SwaggerDocumentationTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void exposesOpenApiDocumentWithBearerSchemeAndAuthOperations() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.info.title").value("KeyFin API"))
				.andExpect(jsonPath("$.components.securitySchemes.bearerAuth.type").value("http"))
				.andExpect(jsonPath("$.components.securitySchemes.bearerAuth.scheme").value("bearer"))
				.andExpect(jsonPath("$.paths['/api/v1/auth/login'].post.summary").value("로그인"))
				.andExpect(jsonPath("$.paths['/api/v1/auth/login'].post.responses['200']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/auth/login'].post.responses['401']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/auth/refresh'].post.summary").value("Access Token 재발급"))
				.andExpect(jsonPath("$.paths['/api/v1/auth/refresh'].post.responses['401']").exists());
	}
}
