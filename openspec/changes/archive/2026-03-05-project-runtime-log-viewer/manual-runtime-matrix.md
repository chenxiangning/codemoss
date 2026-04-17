# runtime matrix
- generated_at: 2026-03-04 01:17:48 +0800
- node: v25.2.1
- npm: npm warn Unknown user config "electron_mirror". This will stop working in the next major version of npm.
11.6.2
- python: missing
- python3: Python 3.14.2
- go: missing

### 1. react - start/stop
- command: `npm run dev`
- exit_code_after_stop: -15
- log_excerpt:
~~~text
npm warn Unknown user config "electron_mirror". This will stop working in the next major version of npm.

> dev
> node dev.js

react-dev: boot
react-dev: tick-1
react-dev: tick-2
react-dev: tick-3
react-dev: tick-4
~~~

### 2. react - fail/exit
- command: `npm run fail`
- exit_code: 1
- log_excerpt:
~~~text
npm warn Unknown user config "electron_mirror". This will stop working in the next major version of npm.

> fail
> node fail.js

react-fail: boom
~~~

### 3. vue - start/stop
- command: `npm run dev`
- exit_code_after_stop: -15
- log_excerpt:
~~~text
npm warn Unknown user config "electron_mirror". This will stop working in the next major version of npm.

> dev
> node dev.js

vue-dev: boot
vue-dev: tick-1
vue-dev: tick-2
vue-dev: tick-3
vue-dev: tick-4
~~~

### 4. vue - fail/exit
- command: `npm run fail`
- exit_code: 1
- log_excerpt:
~~~text
npm warn Unknown user config "electron_mirror". This will stop working in the next major version of npm.

> fail
> node fail.js

vue-fail: boom
~~~

### 5. python-override - start/stop
- command: `python3 main.py`
- exit_code_after_stop: -15
- log_excerpt:
~~~text
python-main: boot
python-main: tick-1
python-main: tick-2
python-main: tick-3
python-main: tick-4
python-main: tick-5
~~~

### 6. python-default-fail - fail/exit
- command: `python main.py`
- exit_code: 127
- log_excerpt:
~~~text
/bin/bash: python: command not found
~~~

### 7. go-default-fail - fail/exit
- command: `go run .`
- exit_code: 127
- log_excerpt:
~~~text
/bin/bash: go: command not found
~~~

### 8. go-custom-override - start/stop
- command: `bash -lc "echo go-override: boot; i=0; while true; do i=$((i+1)); echo go-override: tick-$i; sleep 0.4; done"`
- exit_code_after_stop: -15
- log_excerpt:
~~~text
Now using node v16.20.2 (npm v8.19.4)
go-override: boot
go-override: tick-
go-override: tick-
go-override: tick-
go-override: tick-
~~~

## Java manual regression
### java-sample - start/stop
- command: `mvn -q spring-boot:run -Dspring-boot.run.jvmArguments='-Dserver.port=0'`
- exit_code_after_stop: -9
- log_excerpt:
~~~text

  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
( ( )\___ | '_ | '_| | '_ \/ _` | \ \ \ \
 \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
  '  |____| .__|_| |_|_| |_\__, | / / / /
 =========|_|==============|___/=/_/_/_/
 :: Spring Boot ::                (v3.2.4)

2026-03-04T01:22:53.352+08:00  INFO 53011 --- [           main] com.example.DemoApplication              : Starting DemoApplication using Java 17.0.10 with PID 53011 (/private/tmp/runtime-matrix/java-sample/target/classes started by chenxiangning in /private/tmp/runtime-matrix/java-sample)
2026-03-04T01:22:53.354+08:00  INFO 53011 --- [           main] com.example.DemoApplication              : No active profile set, falling back to 1 default profile: "default"
2026-03-04T01:22:53.676+08:00  INFO 53011 --- [           main] o.s.b.w.embedded.tomcat.TomcatWebServer  : Tomcat initialized with port 0 (http)
2026-03-04T01:22:53.680+08:00  INFO 53011 --- [           main] o.apache.catalina.core.StandardService   : Starting service [Tomcat]
2026-03-04T01:22:53.681+08:00  INFO 53011 --- [           main] o.apache.catalina.core.StandardEngine    : Starting Servlet engine: [Apache Tomcat/10.1.19]
2026-03-04T01:22:53.705+08:00  INFO 53011 --- [           main] o.a.c.c.C.[Tomcat].[localhost].[/]       : Initializing Spring embedded WebApplicationContext
2026-03-04T01:22:53.706+08:00  INFO 53011 --- [           main] w.s.c.ServletWebServerApplicationContext : Root WebApplicationContext: initialization completed in 334 ms
2026-03-04T01:22:53.832+08:00  INFO 53011 --- [           main] o.s.b.w.embedded.tomcat.TomcatWebServer  : Tomcat started on port 53610 (http) with context path ''
2026-03-04T01:22:53.836+08:00  INFO 53011 --- [           main] com.example.DemoApplication              : Started DemoApplication in 0.617 seconds (process running for 0.731)
~~~

### java-sample - fail
- command: `mvn -q -f missing-pom.xml spring-boot:run`
- exit_code: 1
- log_excerpt:
~~~text
POM file missing-pom.xml specified with the -f/--file command line argument does not exist
[ERROR] [ERROR] Some problems were encountered while processing the POMs:
[FATAL] Non-readable POM /private/tmp/runtime-matrix/java-sample/missing-pom.xml: /private/tmp/runtime-matrix/java-sample/missing-pom.xml (No such file or directory) @ 
 @ 
[ERROR] The build could not read 1 project -> [Help 1]
[ERROR]   
[ERROR]   The project  (/private/tmp/runtime-matrix/java-sample/missing-pom.xml) has 1 error
[ERROR]     Non-readable POM /private/tmp/runtime-matrix/java-sample/missing-pom.xml: /private/tmp/runtime-matrix/java-sample/missing-pom.xml (No such file or directory)
[ERROR] 
[ERROR] To see the full stack trace of the errors, re-run Maven with the -e switch.
[ERROR] Re-run Maven using the -X switch to enable full debug logging.
[ERROR] 
[ERROR] For more information about the errors and possible solutions, please read the following articles:
[ERROR] [Help 1] http://cwiki.apache.org/confluence/display/MAVEN/ProjectBuildingException
~~~
