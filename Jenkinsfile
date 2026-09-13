pipeline {
    agent { label 'backend-ci' }

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        skipStagesAfterUnstable()
        timeout(time: 20, unit: 'MINUTES')
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
                    junit testResults: 'backend/key-fin/build/test-results/test/*.xml',
                          allowEmptyResults: false
                }
            }
        }

        stage('Package JAR') {
            steps {
                dir('backend/key-fin') {
                    sh 'bash ./gradlew --no-daemon --max-workers=1 --console=plain --stacktrace bootJar'
                }
            }
        }
    }

    post {
        success {
            archiveArtifacts artifacts: 'backend/key-fin/build/libs/*.jar',
                             fingerprint: true,
                             onlyIfSuccessful: true
        }
    }
}
