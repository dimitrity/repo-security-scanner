# Dockerfile Security Fixes

## Issue Identified

The original Dockerfile was missing a `USER` directive, causing the container to run as `root`. This is a significant security vulnerability identified by Semgrep rule `dockerfile.security.missing-user.missing-user`.

### Security Risk
Running containers as root provides excessive privileges and creates several security risks:
- **Privilege Escalation**: If an attacker gains access, they have full system control
- **Container Escape**: Potential to break out of container isolation
- **Host System Compromise**: Access to host resources and files
- **Resource Abuse**: Ability to consume unlimited system resources

## Security Fixes Implemented

### 1. **Non-Root User Creation**

Added a dedicated non-root user for running the application:

```dockerfile
# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs
```

**Security Benefits:**
- Dedicated user with minimal privileges
- Specific UID/GID to avoid conflicts
- System user (`-S` flag) for better security

### 2. **Proper File Ownership**

Ensured all application files are owned by the non-root user:

```dockerfile
# Change ownership of application files to non-root user
RUN chown -R nestjs:nodejs /app

# Install semgrep as root, then change ownership
RUN pip install semgrep && \
    chown -R nestjs:nodejs /venv
```

**Security Benefits:**
- Application can read/write its own files
- Prevents privilege escalation through file manipulation
- Maintains proper access controls

### 3. **User Switching**

Added explicit user switching before running the application:

```dockerfile
# Switch to non-root user for security
USER nestjs

# Start the NestJS microservice
CMD ["node", "dist/main.js"]
```

**Security Benefits:**
- Container runs with minimal privileges
- Follows principle of least privilege
- Reduces attack surface

### 4. **Multi-Stage Build Security**

Maintained security in both build and production stages:

```dockerfile
# Builder stage (can run as root for build operations)
FROM node:20-alpine as builder
# ... build operations ...

# Production stage (runs as non-root)
FROM node:20-alpine as production
# ... security hardening ...
USER nestjs
```

**Security Benefits:**
- Build tools available during build phase
- Production image hardened and minimal
- Clear separation of concerns

## Security Best Practices Implemented

### ✅ **Principle of Least Privilege**
- Application runs with minimal required permissions
- Dedicated user with specific UID/GID
- No unnecessary root access

### ✅ **File System Security**
- Proper ownership of all application files
- Virtual environment accessible to application user
- Secure file permissions

### ✅ **Container Hardening**
- Non-root user execution
- Minimal attack surface
- Proper resource isolation

### ✅ **Build Security**
- Multi-stage build for security
- Build dependencies isolated from production
- Clean production image

## Security Compliance

These fixes address:

- **Docker Security Best Practices**: Running containers as non-root
- **OWASP Container Security**: Principle of least privilege
- **CIS Docker Benchmark**: User management recommendations
- **Semgrep Rule**: `dockerfile.security.missing-user.missing-user`

## Testing the Security Fixes

### 1. **Build and Run Container**
```bash
# Build the secure container
docker build -t repo-security-scanner .

# Run container and verify user
docker run --rm repo-security-scanner whoami
# Should output: nestjs
```

### 2. **Verify Non-Root Execution**
```bash
# Check process user
docker run --rm repo-security-scanner ps aux
# Should show processes running as nestjs, not root
```

### 3. **Test Semgrep Scan**
```bash
# Run Semgrep on the Dockerfile
semgrep --config=auto Dockerfile
# Should no longer report missing-user vulnerability
```

### 4. **Security Scanning**
```bash
# Use Docker Scout or similar tools
docker scout cves repo-security-scanner
```

## Additional Security Recommendations

### 1. **Runtime Security**
```bash
# Run with additional security options
docker run --rm \
  --user nestjs \
  --read-only \
  --tmpfs /tmp \
  repo-security-scanner
```

### 2. **Network Security**
```bash
# Limit network access
docker run --rm \
  --network none \
  repo-security-scanner
```

### 3. **Resource Limits**
```bash
# Set resource limits
docker run --rm \
  --memory=512m \
  --cpus=1.0 \
  repo-security-scanner
```

## Security Monitoring

### 1. **Container Runtime Security**
- Monitor for privilege escalation attempts
- Track file system changes
- Log security events

### 2. **Vulnerability Scanning**
- Regular container image scanning
- Dependency vulnerability checks
- Base image security updates

### 3. **Compliance Monitoring**
- Regular security audits
- Policy compliance checks
- Security best practice validation

## Benefits of the Security Fixes

### 🔒 **Reduced Attack Surface**
- Minimal privileges reduce potential damage
- Limited access to host resources
- Better isolation from other containers

### 🛡️ **Improved Security Posture**
- Follows security best practices
- Complies with industry standards
- Reduces security audit findings

### 📋 **Better Compliance**
- Meets Docker security requirements
- Addresses Semgrep security rules
- Follows OWASP recommendations

### 🔍 **Enhanced Monitoring**
- Clear user attribution for logs
- Better audit trail
- Easier security incident response

The Dockerfile now follows security best practices and provides a secure foundation for running the repository security scanner application. 