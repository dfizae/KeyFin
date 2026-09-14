package com.finset.key_fin.coaching;

import com.finset.key_fin.global.exception.GlobalExceptionHandler;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.servlet.context.AnnotationConfigServletWebServerApplicationContext;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.DispatcherServlet;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Embedded real Tomcat/MVC + JDBC + HTTP. Only principal establishment uses a test filter. */
class CoachingSourceHttpTest {
    private CoachingSourceAdapterTest fixture;
    private AnnotationConfigServletWebServerApplicationContext context;
    private URI origin;
    private final JsonMapper mapper=JsonMapper.builder().build();
    private final HttpClient client=HttpClient.newHttpClient();

    void start(boolean python) throws Exception {
        fixture=new CoachingSourceAdapterTest(); fixture.setUp();
        if (python) fixture.useUpstream(System.getenv("COACHING_CONTRACT_API_URL"),
                System.getenv("COACHING_CONTRACT_BACKEND_TOKEN"),System.getenv("COACHING_CONTRACT_USER_TOKEN"));
        context=new AnnotationConfigServletWebServerApplicationContext();
        context.registerBean(CoachingSourceAdapter.class,fixture::sourceAdapter);
        context.registerBean(CoachingClient.class,fixture::sourceClient);
        context.register(WebConfiguration.class); context.refresh();
        origin=URI.create("http://127.0.0.1:"+context.getWebServer().getPort());
    }
    @AfterEach void close() { if(context!=null)context.close(); if(fixture!=null)fixture.stop(); }

    @Test void authenticatesTheAppRequestAndDerivesBootstrapFromItsSourceDatabase() throws Exception {
        start(false);
        var result=post("/source/bootstrap","{\"asOf\":\"2026-09-03\"}","http-bootstrap");
        assertTrue(result.at("/readiness/canSyncHistory").asBoolean());
        assertFalse(result.at("/readiness/cashForecastReady").asBoolean());
        assertEquals(1,result.at("/upstream/revision").asInt());
        var denied=client.send(HttpRequest.newBuilder(origin.resolve("/api/v1/coaching/source/readiness?asOf=2026-09-03"))
                .GET().build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(401,denied.statusCode());
    }

    @Test @EnabledIfEnvironmentVariable(named="COACHING_CONTRACT_API_URL",matches=".+")
    void roundTripsSourceHistoryPaymentCancellationAndChatThroughThePythonApi() throws Exception {
        start(true);
        assertEquals(0,post("/source/bootstrap","{\"asOf\":\"2026-09-03\"}","wire-bootstrap").at("/upstream/revision").asInt());
        var session=post("/sessions","{}","wire-session");
        var before=post("/sessions/"+session.get("id").asString()+"/messages",
                "{\"question\":\"이번 달 외식비 얼마 썼어?\"}","wire-history-before");
        assertEquals("spending_history",before.path("answer_type").asString());
        assertEquals(10000,before.at("/evidence/spending/total_krw").asLong());
        fixture.commitPayment();
        var paid=post("/source/synchronize","{\"asOf\":\"2026-09-03\"}","wire-payment");
        assertEquals("synchronized",paid.path("status").asString());
        var during=post("/sessions/"+session.get("id").asString()+"/messages",
                "{\"question\":\"이번 달 외식비 얼마 썼어?\"}","wire-history-during");
        assertEquals(70000,during.at("/evidence/spending/total_krw").asLong());
        fixture.cancelPayment();
        var canceled=post("/source/synchronize","{\"asOf\":\"2026-09-03\"}","wire-cancel");
        assertEquals("synchronized",canceled.path("status").asString());
        assertEquals("unchanged",post("/source/synchronize","{\"asOf\":\"2026-09-03\"}","wire-duplicate").path("status").asString());
        var after=post("/sessions/"+session.get("id").asString()+"/messages",
                "{\"question\":\"이번 달 외식비 얼마 썼어?\"}","wire-history-after");
        assertEquals(10000,after.at("/evidence/spending/total_krw").asLong());
        assertEquals(2,after.at("/evidence/identity/revision").asInt());
        capture("source-history-before.json",before); capture("source-history-after.json",after);
        capture("source-payment-result.json",paid); capture("source-cancellation-result.json",canceled);
        // Launch the unchanged app API/envelope/parser over TCP while this servlet and Python are live.
        if ("1".equals(System.getenv("COACHING_VERIFY_FRONTEND"))) {
            var output=Path.of(System.getenv("COACHING_SOURCE_CAPTURE_DIR"),"frontend-http.log");
            // PowerShell reads pnpm's UTF-8 shim correctly when the workspace path contains Hangul.
            var process=new ProcessBuilder("powershell.exe","-NoProfile","-ExecutionPolicy","Bypass","-Command",
                    "pnpm exec jest --runInBand features/coaching/__tests__/live-api.test.ts");
            process.directory(Path.of("../../frontend").toFile());
            process.environment().put("EXPO_PUBLIC_API_URL",origin.toString());
            process.environment().put("COACHING_HTTP_CONTRACT","1");
            process.environment().put("NODE_PATH",Path.of("../../frontend/node_modules/.pnpm/node_modules")
                    .toAbsolutePath().normalize().toString());
            process.redirectErrorStream(true).redirectOutput(output.toFile());
            var running=process.start();
            try {
                assertTrue(running.waitFor(90,java.util.concurrent.TimeUnit.SECONDS),"Frontend HTTP test timeout");
                assertEquals(0,running.exitValue(),"Frontend HTTP contract failed; inspect frontend-http.log");
            } finally {
                if(running.isAlive()) { running.descendants().forEach(ProcessHandle::destroyForcibly); running.destroyForcibly(); }
            }
        }
    }
    private JsonNode post(String path,String body,String key) throws Exception {
        var response=client.send(HttpRequest.newBuilder(origin.resolve("/api/v1/coaching"+path)).timeout(Duration.ofSeconds(30))
                .header("Authorization","Bearer synthetic-app-one").header("Idempotency-Key",key)
                .header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build(),
                HttpResponse.BodyHandlers.ofString());
        assertEquals(200,response.statusCode(),()->"Unexpected HTTP status on "+path);
        return mapper.readTree(response.body()).get("data");
    }
    private void capture(String name,JsonNode value) throws Exception {
        var directory=System.getenv("COACHING_SOURCE_CAPTURE_DIR");
        if(directory!=null) { Files.createDirectories(Path.of(directory)); Files.writeString(Path.of(directory,name),mapper.writeValueAsString(value)); }
    }

    @Configuration @EnableWebMvc
    @Import({CoachingSourceController.class,CoachingController.class,GlobalExceptionHandler.class})
    static class WebConfiguration implements WebMvcConfigurer {
        @Bean TomcatServletWebServerFactory webServerFactory() { return new TomcatServletWebServerFactory(0); }
        @Bean DispatcherServlet dispatcherServlet() { return new DispatcherServlet(); }
        @Bean ServletRegistrationBean<DispatcherServlet> dispatcherRegistration(DispatcherServlet servlet) {
            return new ServletRegistrationBean<>(servlet,"/");
        }
        @Override public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
            resolvers.add(new AuthenticationPrincipalArgumentResolver());
        }
        @Bean FilterRegistrationBean<OncePerRequestFilter> syntheticPrincipal() {
            var filter=new OncePerRequestFilter() {
                @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,
                        FilterChain chain) throws ServletException,IOException {
                    if(!"Bearer synthetic-app-one".equals(request.getHeader("Authorization"))) { response.setStatus(401); return; }
                    SecurityContextHolder.getContext().setAuthentication(
                            UsernamePasswordAuthenticationToken.authenticated(1L,null,List.of()));
                    try { chain.doFilter(request,response); } finally { SecurityContextHolder.clearContext(); }
                }
            };
            return new FilterRegistrationBean<>(filter);
        }
    }
}
