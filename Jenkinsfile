pipeline {
    agent any

    environment {
        NODE_ENV = 'development'
    }

    tools {
        nodejs 'node' // Requires NodeJS plugin configured with name 'node' in Jenkins
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Backend: Setup & Checks') {
            steps {
                dir('backend') {
                    echo 'Installing backend dependencies...'
                    sh 'npm install'

                    echo 'Running backend linting...'
                    sh 'npm run lint'

                    echo 'Running backend typecheck...'
                    sh 'npm run typecheck'

                    echo 'Running backend tests...'
                    sh 'npm run test'

                    echo 'Building backend...'
                    sh 'npm run build'
                }
            }
        }

        stage('Frontend: Setup & Checks') {
            steps {
                dir('frontend') {
                    echo 'Installing frontend dependencies...'
                    sh 'npm install'

                    echo 'Running frontend typecheck...'
                    sh 'npm run typecheck'

                    echo 'Running frontend tests...'
                    sh 'npm run test'
                }
            }
        }
    }

    post {
        always {
            echo 'Pipeline finished.'
        }
        success {
            echo 'All checks passed successfully!'
        }
        failure {
            echo 'One or more checks failed. Please review the logs.'
        }
    }
}
