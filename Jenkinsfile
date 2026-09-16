pipeline {
    agent { label 'backend-ci' }

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        skipStagesAfterUnstable()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Checkout') {
            steps {
                // Start with a clean workspace so old reports cannot be published.
                deleteDir()
                // Repository, branch and credentials come from the Jenkins job's SCM settings.
                checkout scm
                sh 'git log -1 --format="%H %s"'
            }
        }

        stage('Environment Check') {
            steps {
                sh '''
                    set -eu
                    echo "Node: $NODE_NAME"
                    java -version
                    javac -version
                    git --version
                    test -S /var/run/docker.sock
                    test -r /var/run/docker.sock
                    test -w /var/run/docker.sock
                '''
            }
        }

        stage('Backend Test') {
            steps {
                dir('backend/key-fin') {
                    sh 'bash ./gradlew --no-daemon --max-workers=1 --console=plain --stacktrace clean test'
                }
            }
            post {
                always {
                    junit testResults: 'backend/key-fin/build/test-results/test/*.xml', allowEmptyResults: false
                }
            }
        }

        stage('Package JAR') {
            steps {
                dir('backend/key-fin') {
                    sh 'bash ./gradlew --no-daemon --max-workers=1 --console=plain --stacktrace bootJar'
                }
            }
            post {
                success {
                    archiveArtifacts artifacts: 'backend/key-fin/build/libs/*.jar',
                                    fingerprint: true
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    env.CI_COMMIT = sh(
                        script: 'git rev-parse HEAD',
                        returnStdout: true
                    ).trim()

                    env.APP_IMAGE =
                        "keyfin-backend:ci-${env.BUILD_NUMBER}-${env.CI_COMMIT.take(12)}"
                }

                sh '''
                    set -eu

                    mkdir -p .ci-image
                    jar_count=0

                    for jar_file in backend/key-fin/build/libs/*.jar; do
                        [ -f "$jar_file" ] || continue

                        case "$jar_file" in
                            *-plain.jar) continue ;;
                        esac

                        cp "$jar_file" .ci-image/app.jar
                        jar_count=$((jar_count + 1))
                    done

                    test "$jar_count" -eq 1

                    cp backend/key-fin/Dockerfile.runtime .ci-image/Dockerfile

                    docker build \
                        --label "org.opencontainers.image.revision=$CI_COMMIT" \
                        -t "$APP_IMAGE" .ci-image
                '''
            }
        }

        stage('Deploy Backend') {
            steps {
                sh '''
                    set -eu

                    test "$(git rev-parse HEAD)" = \
                        "$(git rev-parse refs/remotes/origin/develop)"

                    bash infra/jenkins/deploy-backend.sh "$APP_IMAGE"
                '''
            }
        }
    }

    post {
        always {
            script {
                def result = currentBuild.currentResult

                def notifications = [
                    SUCCESS: [
                        color: 'good',
                        title: '✅ 백엔드 테스트·배포 성공'
                    ],
                    FAILURE: [
                        color: 'danger',
                        title: '❌ 백엔드 파이프라인 실패 — 로그 확인 필요'
                    ],
                    UNSTABLE: [
                        color: 'warning',
                        title: '⚠️ 백엔드 파이프라인 불안정 — 테스트 결과 확인 필요'
                    ],
                    ABORTED: [
                        color: '#808080',
                        title: '⏹️ 백엔드 파이프라인 중단'
                    ]
                ]

                def notification = notifications[result] ?: [
                    color: '#808080',
                    title: "ℹ️ 백엔드 파이프라인 종료: ${result}"
                ]

                def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: '확인 불가'
                def commit = env.CI_COMMIT ?: env.GIT_COMMIT
                def shortCommit = commit ? commit.take(8) : '확인 불가'

                def message = [
                    "**${notification.title}**",
                    "작업: ${env.JOB_NAME} · 빌드: #${env.BUILD_NUMBER}",
                    "브랜치: ${branch} · 커밋: ${shortCommit}",
                    "[실행 결과](${env.BUILD_URL}) · [콘솔 로그](${env.BUILD_URL}console)"
                ].join('\n')

                mattermostSend(
                    color: notification.color,
                    message: message,
                    failOnError: false
                )
            }
        }
    }
}
