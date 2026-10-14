pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    python3 -m venv .venv
                    .venv/bin/pip install --upgrade pip
                    .venv/bin/pip install -r requirements.txt
                '''
            }
        }

        stage('Run Tests') {
            steps {
                sh '''
                    PYTHONPATH=. .venv/bin/pytest -q
                '''
            }
        }

        stage('Validate Flask App') {
            steps {
                sh '''
                    .venv/bin/python -m py_compile app.py
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    docker build -t smart-library-management:latest .
                '''
            }
        }

        stage('Deploy Container') {
            steps {
                sh '''
                    docker rm -f smart-library-api || true
                    docker run -d \
                        --name smart-library-api \
                        -p 5001:5000 \
                        smart-library-management:latest
                '''
            }
        }
    }

    post {
        success {
            echo 'Tests passed and application deployed successfully.'
        }

        failure {
            echo 'Pipeline failed. Check the console output.'
        }
    }
}
