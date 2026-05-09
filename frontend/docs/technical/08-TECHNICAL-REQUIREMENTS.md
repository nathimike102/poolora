# Technical Requirements & Stack

## Smart Scheduled Car Pooling Platform - Technical Requirements

---

## 1. Technology Stack

### 1.1 Frontend

| Category               | Technology                                    | Version | Purpose                    |
| ---------------------- | --------------------------------------------- | ------- | -------------------------- |
| Mobile Framework       | React Native                                  | 0.72+   | Cross-platform mobile app  |
| Web Framework          | React                                         | 18.2+   | Admin dashboard            |
| State Management       | Redux Toolkit                                 | 1.9+    | App state management       |
| HTTP Client            | Axios                                         | 1.4+    | API requests               |
| Navigation (Mobile)    | React Navigation                              | 6.0+    | Mobile navigation          |
| UI Components (Mobile) | React Native Paper                            | 5.0+    | Material Design components |
| UI Components (Web)    | Material-UI                                   | 5.14+   | Web UI components          |
| Maps                   | Mapbox Free Tier (Google Maps for production) | Latest  | Location services          |
| Forms                  | React Hook Form                               | 7.45+   | Form handling              |
| Validation             | Yup                                           | 1.2+    | Schema validation          |
| Testing                | Jest                                          | 29.5+   | Unit testing               |
| E2E Testing            | Detox (Mobile) / Cypress (Web)                | Latest  | End-to-end testing         |
| Build Tool (Web)       | Vite                                          | 4.3+    | Web build tool             |
| Package Manager        | npm / yarn                                    | 8.0+    | Dependency management      |

### 1.2 Backend

| Category        | Technology                                          | Version | Purpose                      |
| --------------- | --------------------------------------------------- | ------- | ---------------------------- |
| Runtime         | Node.js                                             | 18 LTS+ | JavaScript runtime           |
| Framework       | Express.js                                          | 4.18+   | Web framework                |
| Language        | TypeScript                                          | 5.0+    | Type safety                  |
| Database        | MongoDB                                             | 6.0+    | Document storage             |
| Cache           | Redis                                               | 7.0+    | Caching & sessions           |
| Message Queue   | RabbitMQ (Kafka for production scale)               | Latest  | Event processing & streaming |
| Event Streaming | Apache Kafka                                        | Latest  | High-throughput event bus    |
| Search Engine   | Elasticsearch                                       | 8.0+    | Advanced search              |
| ORM/ODM         | Mongoose                                            | 7.0+    | MongoDB abstraction          |
| Validation      | Joi                                                 | 17.9+   | Request validation           |
| Authentication  | jsonwebtoken                                        | 9.0+    | JWT handling                 |
| Hashing         | bcryptjs                                            | 2.4+    | Password hashing             |
| API Docs        | Swagger/OpenAPI                                     | 3.0     | API documentation            |
| Testing         | Jest                                                | 29.5+   | Unit testing                 |
| HTTP Testing    | Supertest                                           | 6.3+    | API testing                  |
| Logging         | Winston                                             | 3.8+    | Structured logging           |
| Monitoring      | Sentry Free Tier (New Relic/Datadog for production) | Latest  | APM & monitoring             |

### 1.3 DevOps & Infrastructure

| Category               | Technology                                                | Purpose                 |
| ---------------------- | --------------------------------------------------------- | ----------------------- |
| Containerization       | Docker                                                    | Container runtime       |
| Orchestration          | Docker Compose (Kubernetes for production)                | Container orchestration |
| Cloud Provider         | Render.com / Railway (AWS/GCP for production)             | Cloud hosting           |
| CI/CD                  | GitHub Actions                                            | Automation              |
| Container Registry     | Docker Hub Free Tier (Amazon ECR for production)          | Image storage           |
| Load Balancing         | Nginx (AWS ALB for production)                            | Traffic distribution    |
| Storage                | Cloudinary Free Tier (AWS S3 for production)              | File storage            |
| CDN                    | Cloudflare Free (CloudFront for production)               | Content delivery        |
| Monitoring             | Grafana Cloud Free (CloudWatch/Datadog for production)    | System monitoring       |
| Log Aggregation        | Better Stack Free (ELK Stack/Datadog for production)      | Log management          |
| Secret Management      | .env with encryption (AWS Secrets Manager for production) | Secrets handling        |
| Infrastructure as Code | Terraform / CloudFormation                                | IaC                     |

### 1.4 Message Queue & Event Streaming Architecture

**Primary (MVP)**: RabbitMQ self-hosted  
**Production**: Apache Kafka

**RabbitMQ Setup (MVP)**:

- **Deployment**: Railway free tier or Docker container on Render.com
- **Queues**: Durable queues for critical events
- **Exchanges**: Topic exchanges for routing
- **Persistence**: Message persistence enabled

**Kafka Cluster Setup (Production)**:

- **Brokers**: 3+ in production (high availability)
- **Replication Factor**: 3 (fault tolerance)
- **Default Retention**: 24 hours (critical events: 30 days)
- **Partitions**: 10+ per topic (parallel processing)
- **Deployment**: Confluent Cloud or AWS MSK (fully managed)

**Critical Event Topics**:

```
ride-events         → ride.created, ride.started, ride.completed, ride.cancelled
payment-events      → payment.initiated, payment.completed, payment.failed, payment.refunded
booking-events      → booking.requested, booking.confirmed, booking.completed, booking.rejected
user-events         → user.registered, user.verified, user.blocked, user.deleted
safety-events       → sos.triggered, fraud.detected, user.reported
rating-events       → rating.submitted, rating.updated
notification-events → notification.sent, notification.failed
parcel-events       → parcel.created, parcel.matched, parcel.delivered (Phase 4)
trip-events         → trip.created, trip.expense_added, trip.settlement_calculated (Phase 4)
```

**Why Kafka for this system**:

- High throughput: Handles 1000+ events/second peak
- Event replay: Rewind and replay events for debugging/analytics
- Multiple consumers: Notification, Analytics, Safety, Rating services all consume same events
- Event sourcing: Immutable log provides audit trail
- Scalability: Horizontal partitioning enables easy scale-out

---

### 1.5 Third-Party Services

| Service            | Provider                                   | Purpose               |
| ------------------ | ------------------------------------------ | --------------------- |
| Payment Processing | Stripe Test Mode (Razorpay for production) | Payment gateway       |
| Maps               | Google Maps API                            | Location services     |
| SMS Gateway        | Twilio                                     | SMS notifications     |
| Email Service      | SendGrid                                   | Email notifications   |
| Push Notifications | Firebase                                   | Push notifications    |
| Authentication     | Firebase Auth                              | Optional auth service |
| Video Streaming    | Agora / Twilio                             | Optional video calls  |
| Analytics          | Google Analytics / Mixpanel                | User analytics        |

---

## 2. System Requirements

### 2.1 Development Environment

**Minimum Requirements**:

- **OS**: macOS 10.15+, Linux (Ubuntu 18.04+), or Windows 10+
- **RAM**: 8 GB
- **Disk Space**: 20 GB
- **Node.js**: 18 LTS or later
- **npm/yarn**: Latest version

**Recommended Setup**:

- **OS**: macOS 12+ or Linux (Ubuntu 20.04+)
- **RAM**: 16 GB+
- **Disk Space**: 50 GB SSD
- **IDE**: VS Code with extensions

### 2.2 Staging Environment

- **OS**: Ubuntu 20.04 LTS
- **RAM**: 16 GB
- **CPU**: 4 cores
- **Storage**: 100 GB SSD
- **Database**: MongoDB Atlas M10+

### 2.3 Production Environment

- **OS**: Ubuntu 20.04 LTS or Amazon Linux 2
- **RAM**: 32 GB+ (Auto-scaling)
- **CPU**: 8+ cores (Auto-scaling)
- **Storage**: 500 GB+ SSD
- **Database**: MongoDB Atlas M30+ with replication
- **Availability**: Multi-AZ deployment

---

## 3. Performance Requirements

### 3.1 Response Time

| Feature         | Target | Max   |
| --------------- | ------ | ----- |
| Login           | <500ms | 1s    |
| Search Rides    | <1s    | 2s    |
| Create Booking  | <500ms | 1s    |
| Payment         | <2s    | 3s    |
| Location Update | <500ms | 1s    |
| Chat Message    | <300ms | 500ms |

### 3.2 Scalability

- **Concurrent Users**: 10,000+ simultaneous
- **Requests/Second**: 1,000+ RPS
- **Database Throughput**: 100,000+ reads/sec, 50,000+ writes/sec
- **Cache Hit Ratio**: >80%

### 3.3 Availability

- **Uptime SLA**: 99.5%
- **Max Downtime**: 3.6 hours/month
- **MTTR (Mean Time To Recovery)**: <15 minutes

---

## 4. Security Requirements

### 4.1 Authentication & Authorization

- **Password**: Minimum 8 characters, complexity requirements
- **OTP**: 6-digit, 10-minute expiry
- **JWT**: HS256 minimum, 24-hour expiry
- **Sessions**: 30-day refresh token window
- **RBAC**: Fine-grained role-based access control

### 4.2 Data Protection

- **Encryption at Rest**: AES-256
- **Encryption in Transit**: TLS 1.3
- **PII Fields**: Tokenization or encryption
- **Backups**: Encrypted, geographically redundant
- **Key Rotation**: Quarterly

---

## 2. Docker Containerization Strategy

### 2.1 Docker Architecture

**Benefits**:

- Consistent environments (dev → staging → production)
- Efficient scaling (spin containers up/down instantly)
- Resource isolation (prevent service interference)
- Simplified deployment (single artifact per service)

**Docker Image Standards**:

```dockerfile
# Multi-stage build to minimize final image size
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .
USER nodejs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node healthcheck.js || exit 1
CMD ["node", "dist/index.js"]
```

**Image Requirements**:

- Size: 150-300MB per service (using Alpine base)
- Security: Non-root user, minimal attack surface
- Health checks: Implemented for all containers
- Registry: Amazon ECR (private, IAM integrated)

**Container Orchestration Requirements**:

- 10+ services containerized
- Rolling deployments (zero downtime)
- Service networking (inter-service communication)
- Health monitoring and auto-recovery

---

## 3. Kubernetes Orchestration

### 3.1 Kubernetes Cluster Architecture

**High Availability Setup**:

```yaml
Kubernetes Cluster (Production)
├── Control Plane (3 nodes for HA)
│   ├── API Server
│   ├── Scheduler
│   ├── Controller Manager
│   └── etcd (state store, replicated)
│
├── Worker Nodes (5-10 for production)
│   ├── Kubelet
│   ├── kube-proxy
│   ├── Container Runtime (Docker)
│   └── Monitoring agents
│
├── Load Balancer (AWS ALB / NLB)
├── Ingress Controller (Nginx)
└── Storage Classes (EBS, EFS)
```

### 3.2 Kubernetes Deployment Patterns

**Deployment Configuration Example**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ride-service
  namespace: production
  labels:
    app: ride-service
    version: v1.0.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1 # One extra pod during update
      maxUnavailable: 0 # Zero downtime
  selector:
    matchLabels:
      app: ride-service
  template:
    metadata:
      labels:
        app: ride-service
        version: v1.0.0
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - ride-service
                topologyKey: kubernetes.io/hostname
      containers:
        - name: ride-service
          image: ecr.../ride-service:v1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
              name: http
          env:
            - name: NODE_ENV
              value: production
            - name: MONGODB_URI
              valueFrom:
                secretKeyRef:
                  name: db-secrets
                  key: mongodb-uri
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "500m"
              memory: "1Gi"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: ride-service
  namespace: production
spec:
  type: ClusterIP
  ports:
    - port: 3000
      targetPort: http
      protocol: TCP
  selector:
    app: ride-service
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ride-service-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ride-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
```

### 3.3 Kubernetes Core Components

**Services Configuration**:

- **10+ Deployments**: One per microservice (Ride, Payment, Auth, Chat, Tracking, etc.)
- **Parcel Service** (Phase 4): New deployment for parcel management
- **Trip Service** (Phase 4): New deployment for trip coordination

**StatefulSets** (for Kafka, Redis):

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: kafka
spec:
  serviceName: kafka
  replicas: 3
  selector:
    matchLabels:
      app: kafka
  template:
    spec:
      containers:
        - name: kafka
          image: confluentinc/cp-kafka:latest
          ports:
            - containerPort: 9092
          volumeMounts:
            - name: kafka-data
              mountPath: /var/lib/kafka/data
  volumeClaimTemplates:
    - metadata:
        name: kafka-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 50Gi
```

**ConfigMaps** (non-sensitive configuration):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: production
data:
  LOG_LEVEL: "info"
  API_TIMEOUT: "30000"
  KAFKA_BROKERS: "kafka-0.kafka:9092,kafka-1.kafka:9092,kafka-2.kafka:9092"
  MONGODB_POOL_SIZE: "10"
```

**Secrets** (sensitive data):

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secrets
  namespace: production
type: Opaque
stringData:
  mongodb-uri: mongodb+srv://user:password@cluster.mongodb.net/dbname
  jwt-secret: your-jwt-secret-key
  stripe-key: your-stripe-api-key # For production: razorpay-key
```

### 3.4 Networking

**Ingress Configuration**:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  namespace: production
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.carpooling.com
      secretName: api-tls
  rules:
    - host: api.carpooling.com
      http:
        paths:
          - path: /api/v1/rides
            pathType: Prefix
            backend:
              service:
                name: ride-service
                port:
                  number: 3000
          - path: /api/v1/payments
            pathType: Prefix
            backend:
              service:
                name: payment-service
                port:
                  number: 3000
```

**Network Policies** (security):

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-ingress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-gateway
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: ride-service
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: production
        - podSelector:
            matchLabels:
              app: api-gateway
```

### 3.5 Storage & Persistence

**Persistent Volumes** (databases, caches):

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
allowVolumeExpansion: true
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongodb-data
  namespace: production
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 500Gi
```

### 3.6 Monitoring & Logging in Kubernetes

**Prometheus/Grafana Integration**:

```yaml
apiVersion: v1
kind: ServiceMonitor
metadata:
  name: ride-service-monitor
  namespace: production
spec:
  selector:
    matchLabels:
      app: ride-service
  endpoints:
    - port: metrics
      interval: 30s
```

**Log Aggregation** (Elasticsearch/Kibana):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
  namespace: production
data:
  fluent-bit.conf: |
    [INPUT]
        name tail
        path /var/log/containers/*.log
        parser docker
    [OUTPUT]
        name es
        match *
        host elasticsearch.production.svc.cluster.local
        port 9200
```

---

## 4. Docker & Kubernetes Deployment Summary

| Aspect                     | Details                                               |
| -------------------------- | ----------------------------------------------------- |
| **Container Count**        | 10-15 services + supporting infrastructure            |
| **Kubernetes Nodes**       | 5-10 worker nodes (auto-scaling enabled)              |
| **Deployment Strategy**    | Rolling updates (zero-downtime)                       |
| **Service Mesh**           | Optional (Istio for advanced traffic management)      |
| **Infrastructure as Code** | Helm charts for all deployments                       |
| **CI/CD Integration**      | GitHub Actions → Kubernetes via kubectl apply         |
| **Backup Strategy**        | Automated Kubernetes etcd backups, database snapshots |
| **Disaster Recovery**      | Multi-region failover capability (future)             |

---

## 5. Quality Metrics

### 5.1 MongoDB Configuration

```
- Replica Set: 3+ nodes
- Sharding: Auto-sharding after 100GB
- Backups: Daily automated backups
- PITR (Point in Time Recovery): 35 days
- Encryption: Default enabled
- Authentication: SCRAM-SHA-256
```

### 5.2 Redis Configuration

```
- Cluster: 6+ nodes
- Replication: Master-Slave
- Persistence: RDB snapshots every 15 minutes
- Memory: Auto-eviction (LRU policy)
- TTL: Automatic expiration
```

---

## 6. Integration Requirements

### 6.1 Stripe Integration (Razorpay for Production)

- **API Version**: Latest stable
- **Webhooks**: Fully implemented
- **Timeout**: 30 seconds
- **Retry**: Exponential backoff
- **Error Handling**: All error codes handled

### 6.2 Google Maps Integration

- **APIs**: Geocoding, Directions, Places, Distance Matrix
- **Rate Limits**: Monitored & optimized
- **Caching**: Results cached for 24 hours
- **Fallback**: Alternative routing algorithm

### 6.3 Firebase Integration

- **Services**: Auth, Messaging, Realtime Database
- **Configuration**: Per environment
- **Security Rules**: Strict, role-based
- **Monitoring**: Firebase Analytics integrated

---

## 7. Deployment Requirements

### 7.1 CI/CD Pipeline

```
Code Push
    ↓
GitHub Actions Trigger
    ↓
Build & Test
    ↓
Docker Build
    ↓
Push to ECR
    ↓
Deploy to Staging
    ↓
E2E Tests
    ↓
Manual Approval
    ↓
Deploy to Production
```

### 7.2 Deployment Checklist

- [ ] All tests passing
- [ ] Code coverage >80%
- [ ] Security scans passing
- [ ] Database migrations run
- [ ] Feature flags configured
- [ ] Monitoring alerts configured
- [ ] Rollback plan ready

---

## 8. Monitoring & Logging

### 8.1 Key Metrics

```
Application:
  - Request rate
  - Error rate
  - Response time p50, p95, p99
  - Active user sessions
  - API endpoint usage

Database:
  - Query latency
  - Connection pool usage
  - Replication lag
  - Disk usage
  - Query throughput

Infrastructure:
  - CPU usage
  - Memory usage
  - Network I/O
  - Disk I/O
  - Container health
```

### 8.2 Alerts

- **Critical**: Page on-call immediately
- **High**: Notify team, need resolution within 1 hour
- **Medium**: Notify team, resolution within 4 hours
- **Low**: Log for review

### 8.3 Logging

- **Level**: DEBUG to FATAL
- **Format**: Structured JSON
- **Retention**: 30 days
- **Analysis**: Searchable, queryable
- **PII Handling**: Masked in logs

---

## 9. Documentation Requirements

### 9.1 Code Documentation

- JSDoc comments for all functions
- README for each module
- Architecture decision records (ADR)
- API documentation (Swagger)
- Database schema documentation

### 9.2 Operational Documentation

- Runbooks for common issues
- Incident response procedures
- Disaster recovery procedures
- Deployment procedures
- Monitoring & alerting setup

---

## 10. Dependencies & Libraries

### 10.1 Core Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.0.0",
    "redis": "^4.6.7",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "joi": "^17.9.2",
    "axios": "^1.4.0",
    "firebase-admin": "^11.10.1"
  },
  "devDependencies": {
    "jest": "^29.5.0",
    "supertest": "^6.3.3",
    "nodemon": "^2.0.22",
    "prettier": "^2.8.8",
    "eslint": "^8.44.0"
  }
}
```

---

## 11. Quality Metrics

### 11.1 Code Quality

- **Code Coverage**: Minimum 80%
- **Cyclomatic Complexity**: Maximum 10
- **Code Duplication**: <3%
- **Technical Debt Ratio**: <5%

### 11.2 Testing

- **Unit Tests**: 1 test per function
- **Integration Tests**: Critical paths covered
- **E2E Tests**: User journeys covered
- **Performance Tests**: Load testing with 5000 concurrent users

---

## 12. Development Workflow

### 12.1 Git Workflow

- **Branching**: Feature branches from develop
- **Naming**: feature/feature-name, bugfix/bug-name
- **PR Review**: Minimum 2 approvals
- **Merge Strategy**: Squash merge to main

### 12.2 Code Standards

- **Linting**: ESLint with strict rules
- **Formatting**: Prettier with auto-fix
- **Naming**: camelCase for variables, PascalCase for classes
- **Comments**: JSDoc for all exports

---
